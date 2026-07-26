import Foundation
import FirebaseAuth

@MainActor
final class DriverStore: ObservableObject {
    @Published private(set) var session: DriverSession?
    @Published private(set) var queueCount = 0
    @Published private(set) var statusMessage = "Pronta para iniciar uma viagem."
    @Published var isWorking = false
    @Published var isScanningTag = false
    @Published private(set) var roster: [DriverRosterEntry] = []
    @Published private(set) var vehicles: [TransportVehicle] = []
    @Published private(set) var isLoadingVehicles = false
    @Published private(set) var tickets: [SupportMessage] = []
    @Published private(set) var isLoadingTickets = false

    private let locationService = LocationService()
    private let nfcScanService = NFCScanService()

    init() {
        session = DriverSessionStore.shared.activeSession
        locationService.onLocation = { [weak self] location in
            Task { @MainActor in
                await self?.enqueueLocation(location)
            }
        }
        if session != nil {
            locationService.beginTracking()
        }
        Task {
            await refreshQueueCount()
            await refreshRoster()
            await loadVehicles()
        }
    }

    func loadVehicles() async {
        isLoadingVehicles = true
        defer { isLoadingVehicles = false }
        do {
            vehicles = try await APIClient.shared.fetchDriverVehicles()
        } catch {
            statusMessage = "Não foi possível carregar os veículos agora."
        }
    }

    func loadTickets() async {
        isLoadingTickets = true
        defer { isLoadingTickets = false }
        do {
            tickets = try await APIClient.shared.fetchDriverMessages()
        } catch {
            statusMessage = "Não foi possível carregar seus chamados agora."
        }
    }

    func sendSupportMessage(subject: String, text: String) async -> Bool {
        do {
            try await APIClient.shared.sendDriverMessage(subject: subject, text: text)
            await loadTickets()
            statusMessage = "Chamado enviado para o administrador."
            return true
        } catch {
            statusMessage = error.localizedDescription
            return false
        }
    }

    func startTrip(vehicleId: String, direction: TripDirection) async {
        isWorking = true
        defer { isWorking = false }

        do {
            let trip = try await APIClient.shared.startTrip(vehicleId: vehicleId, direction: direction)
            let newSession = DriverSession(vehicleId: trip.vehicleId, tripId: trip.id, phase: trip.phase, direction: trip.direction)
            session = newSession
            DriverSessionStore.shared.save(newSession)
            locationService.beginTracking()
            statusMessage = "Viagem iniciada em modo \(trip.phase.title.lowercased())."
            await synchronize()
            await refreshRoster()
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    func changePhase(to phase: TripPhase) async {
        guard var session else { return }
        guard session.phase != phase else { return }
        session.phase = phase
        self.session = session
        DriverSessionStore.shared.save(session)
        await OfflineQueue.shared.enqueue(.phase(session: session, phase: phase))
        statusMessage = "Modo alterado para \(phase.title)."
        await synchronize()
        await refreshRoster()
    }

    func closeTrip() async {
        guard let session else { return }
        guard !roster.contains(where: { $0.status == .onboard }) else {
            statusMessage = "Ainda há alunos marcados na van. Faça o check-out antes de encerrar."
            return
        }
        statusMessage = "Sincronizando antes de encerrar..."
        await synchronize()
        guard queueCount == 0 else {
            statusMessage = "Há pendências sem conexão. A viagem só pode encerrar após sincronizar."
            return
        }
        do {
            try await APIClient.shared.closeTrip(tripId: session.tripId)
            locationService.stopTracking()
            self.session = nil
            roster = []
            DriverSessionStore.shared.clear()
            statusMessage = "Viagem encerrada com segurança."
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    func registerTag(_ tagToken: String) async -> String {
        guard let session else { return "Abra o app e inicie a viagem antes de ler uma tag." }
        await OfflineQueue.shared.enqueue(.nfc(vehicleId: session.vehicleId, tagToken: tagToken))
        statusMessage = "Leitura registrada. Sincronizando..."
        let error = await SyncService.shared.synchronize()
        await refreshQueueCount()
        if let error {
            statusMessage = "Leitura salva no iPhone. Será enviada quando houver conexão."
            return statusMessage
        }
        statusMessage = "Leitura sincronizada com sucesso."
        await refreshRoster()
        return statusMessage
    }

    func scanTag() {
        guard session != nil else {
            statusMessage = "Inicie uma viagem antes de ler uma tag."
            return
        }

        isScanningTag = true
        statusMessage = "Aproxime a tag do topo do iPhone."
        nfcScanService.scan { [weak self] result in
            Task { @MainActor in
                guard let self else { return }
                self.isScanningTag = false
                switch result {
                case .success(let tagToken):
                    _ = await self.registerTag(tagToken)
                case .failure(let error):
                    self.statusMessage = error.localizedDescription
                }
            }
        }
    }

    func synchronize() async {
        let hasSyncError = await SyncService.shared.synchronize() != nil
        await refreshQueueCount()
        if hasSyncError {
            statusMessage = "Há eventos pendentes que serão sincronizados automaticamente."
        }
    }

    func refreshRoster() async {
        guard let session else {
            roster = []
            return
        }
        do {
            roster = try await APIClient.shared.loadTripRoster(tripId: session.tripId)
        } catch {
            statusMessage = "Não foi possível carregar a lista segura da viagem agora."
        }
    }

    func registerException(type: TripExceptionType, note: String, childId: String?) async {
        guard let session else { return }
        await OfflineQueue.shared.enqueue(.exception(session: session, type: type, note: note, childId: childId))
        statusMessage = "Ocorrência registrada. Sincronizando..."
        await synchronize()
        await refreshRoster()
    }

    private func enqueueLocation(_ location: CoordinatePayload) async {
        guard let session else { return }
        await OfflineQueue.shared.enqueue(.location(session: session, location: location))
        await synchronize()
    }

    private func refreshQueueCount() async {
        queueCount = await OfflineQueue.shared.count()
    }
}
