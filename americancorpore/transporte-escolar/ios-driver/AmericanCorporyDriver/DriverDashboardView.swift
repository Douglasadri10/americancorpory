import SwiftUI
import FirebaseAuth

struct DriverDashboardView: View {
    @ObservedObject var store: DriverStore
    var showsSignOut = true
    var title = "Minha rota"

    @State private var vehicleId = ""
    @State private var direction: TripDirection = .toSchool
    @State private var tagToken = ""
    @State private var checkedVehicle = false
    @State private var checkedRoute = false
    @State private var checkedLocation = false
    @State private var isPresentingException = false
    @State private var isPresentingSupport = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    statusCard
                    if let session = store.session {
                        activeTrip(session)
                    } else {
                        startTrip
                    }
                    rosterCard
                    Button("Sincronizar pendências") {
                        Task { await store.synchronize() }
                    }
                    .buttonStyle(.bordered)
                    .disabled(store.isWorking)
                }
                .padding()
            }
            .background(AppPalette.page.ignoresSafeArea())
            .navigationTitle(title)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button {
                            isPresentingSupport = true
                        } label: {
                            Label("Reportar problema", systemImage: "exclamationmark.bubble")
                        }
                        if showsSignOut {
                            Divider()
                            Button(role: .destructive) {
                                try? Auth.auth().signOut()
                            } label: {
                                Label("Sair", systemImage: "arrow.right.square")
                            }
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                }
            }
            .sheet(isPresented: $isPresentingException) {
                TripExceptionView(roster: store.roster) { type, note, childId in
                    await store.registerException(type: type, note: note, childId: childId)
                }
            }
            .sheet(isPresented: $isPresentingSupport) {
                SupportTicketView(store: store)
            }
        }
    }

    private var statusCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label(store.session == nil ? "Pronta para a rota" : "Viagem em andamento", systemImage: store.session == nil ? "checkmark.circle.fill" : "bus.fill")
                .font(.headline)
                .foregroundStyle(store.session == nil ? .green : AppPalette.accent)
            Text(store.statusMessage)
                .font(.subheadline)
            Text(store.queueCount == 0 ? "Tudo sincronizado" : "\(store.queueCount) pendência(s) aguardando conexão")
                .font(.footnote)
                .foregroundStyle(store.queueCount == 0 ? .green : .orange)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color(uiColor: .secondarySystemBackground), in: RoundedRectangle(cornerRadius: 18))
    }

    private var startTrip: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Preparar viagem")
                .font(.title2.bold())
            Text("Escolha a direção para que cada chegada envie o aviso correto ao responsável.")
                .font(.subheadline)
                .foregroundStyle(.secondary)

            Picker("Direção", selection: $direction) {
                ForEach(TripDirection.allCases) { option in
                    Text(option.title).tag(option)
                }
            }
            .pickerStyle(.segmented)

            vehiclePicker

            VStack(alignment: .leading, spacing: 8) {
                Text("Checklist rápido").font(.headline)
                Toggle("Veículo conferido", isOn: $checkedVehicle)
                Toggle("Rota conferida", isOn: $checkedRoute)
                Toggle("Localização ativada", isOn: $checkedLocation)
            }
            .font(.subheadline)

            Button("Iniciar rota") {
                Task {
                    await store.startTrip(
                        vehicleId: vehicleId.trimmingCharacters(in: .whitespacesAndNewlines),
                        direction: direction
                    )
                }
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .disabled(vehicleId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || !isReadyToStart || store.isWorking)
        }
        .padding()
        .background(Color(uiColor: .secondarySystemBackground), in: RoundedRectangle(cornerRadius: 18))
    }

    @ViewBuilder
    private var vehiclePicker: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Veículo").font(.subheadline.weight(.semibold))
                Spacer()
                if store.isLoadingVehicles {
                    ProgressView()
                } else {
                    Button {
                        Task { await store.loadVehicles() }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                    .buttonStyle(.borderless)
                }
            }

            if store.vehicles.isEmpty {
                Text(store.isLoadingVehicles
                    ? "Carregando veículos…"
                    : "Nenhum veículo cadastrado para você ainda. Fale com o administrador ou toque em atualizar.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            } else {
                Picker("Veículo", selection: $vehicleId) {
                    Text("Selecione um veículo").tag("")
                    ForEach(store.vehicles) { vehicle in
                        Text(vehicle.name).tag(vehicle.id)
                    }
                }
                .pickerStyle(.menu)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .task {
            if store.vehicles.isEmpty { await store.loadVehicles() }
        }
        .onChange(of: store.vehicles) { newVehicles in
            // Se o veículo selecionado sumir da lista, limpa a seleção.
            if !vehicleId.isEmpty && !newVehicles.contains(where: { $0.id == vehicleId }) {
                vehicleId = ""
            }
        }
    }

    private var isReadyToStart: Bool {
        checkedVehicle && checkedRoute && checkedLocation
    }

    private func activeTrip(_ session: DriverSession) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(session.direction.title).font(.title3.bold())
                    Text("Veículo: \(session.vehicleId)")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                StatusPill(text: session.phase.title, color: session.phase == .boarding ? .green : .orange)
            }

            Picker("Etapa", selection: Binding(
                get: { store.session?.phase ?? .boarding },
                set: { phase in Task { await store.changePhase(to: phase) } }
            )) {
                ForEach(TripPhase.allCases) { phase in Text(phase.title).tag(phase) }
            }
            .pickerStyle(.segmented)

            Text(session.phase == .boarding
                ? "Leia a tag quando o aluno entrar na van."
                : "Leia a tag quando o aluno chegar à \(session.direction.destinationTitle).")
                .font(.footnote)
                .foregroundStyle(.secondary)

            if AppConfiguration.isNFCReaderEnabled {
                Button {
                    store.scanTag()
                } label: {
                    Label(store.isScanningTag ? "Lendo tag…" : "Ler tag NFC", systemImage: "wave.3.right.circle.fill")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .disabled(store.isScanningTag || store.isWorking)

                Text("Aproxime a tag da parte superior do iPhone.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }

            DisclosureGroup("Modo de teste") {
                TextField("Código da tag", text: $tagToken)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .textFieldStyle(.roundedBorder)
                Button("Registrar código de teste") {
                    let token = tagToken.trimmingCharacters(in: .whitespacesAndNewlines)
                    Task {
                        _ = await store.registerTag(token)
                        tagToken = ""
                    }
                }
                .buttonStyle(.bordered)
                .disabled(tagToken.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || store.isWorking)
            }
            .font(.subheadline)

            HStack {
                Button("Registrar ocorrência") { isPresentingException = true }
                    .buttonStyle(.bordered)
                Spacer()
                Button("Encerrar viagem", role: .destructive) {
                    Task { await store.closeTrip() }
                }
                .buttonStyle(.bordered)
            }
        }
        .padding()
        .background(Color(uiColor: .secondarySystemBackground), in: RoundedRectangle(cornerRadius: 18))
    }

    private var rosterCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text(store.session == nil ? "Alunos da viagem" : "Situação dos alunos")
                        .font(.title3.bold())
                    Text(store.session == nil ? "A lista aparece após iniciar uma viagem." : "Apenas dados necessários para a rota.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                if store.session != nil {
                    Button { Task { await store.refreshRoster() } } label: { Image(systemName: "arrow.clockwise") }
                        .buttonStyle(.bordered)
                }
            }

            if store.roster.isEmpty {
                Text(store.session == nil ? "Inicie a rota para carregar a lista segura de alunos." : "Carregando lista da viagem…")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            } else {
                ForEach(store.roster) { child in
                    HStack(spacing: 10) {
                        Image(systemName: symbol(for: child.status))
                            .foregroundStyle(color(for: child.status))
                            .frame(width: 24)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(child.name).font(.subheadline.weight(.semibold))
                            Text(child.school).font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        StatusPill(text: child.status.title, color: color(for: child.status))
                    }
                    if child.id != store.roster.last?.id { Divider() }
                }
            }
        }
        .padding()
        .background(Color(uiColor: .secondarySystemBackground), in: RoundedRectangle(cornerRadius: 18))
    }

    private func color(for status: DriverStudentStatus) -> Color {
        switch status {
        case .expected: return .gray
        case .onboard: return .blue
        case .completed: return .green
        case .absent: return .orange
        }
    }

    private func symbol(for status: DriverStudentStatus) -> String {
        switch status {
        case .expected: return "person.crop.circle"
        case .onboard: return "bus.fill"
        case .completed: return "checkmark.circle.fill"
        case .absent: return "person.crop.circle.badge.xmark"
        }
    }
}

private struct SupportTicketView: View {
    @ObservedObject var store: DriverStore
    @Environment(\.dismiss) private var dismiss

    @State private var subject = ""
    @State private var text = ""
    @State private var isSending = false

    private var canSend: Bool {
        !subject.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !isSending
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Novo chamado") {
                    TextField("Assunto", text: $subject)
                    TextField("Descreva o problema", text: $text, axis: .vertical)
                        .lineLimit(4...8)
                    Button(isSending ? "Enviando…" : "Enviar para o administrador") {
                        isSending = true
                        Task {
                            let ok = await store.sendSupportMessage(
                                subject: subject.trimmingCharacters(in: .whitespacesAndNewlines),
                                text: text.trimmingCharacters(in: .whitespacesAndNewlines)
                            )
                            isSending = false
                            if ok {
                                subject = ""
                                text = ""
                            }
                        }
                    }
                    .disabled(!canSend)
                }

                Section("Meus chamados") {
                    if store.isLoadingTickets {
                        HStack { ProgressView(); Text("Carregando…").foregroundStyle(.secondary) }
                    } else if store.tickets.isEmpty {
                        Text("Você ainda não abriu chamados.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(store.tickets) { ticket in
                            VStack(alignment: .leading, spacing: 6) {
                                HStack {
                                    Text(ticket.subject).font(.subheadline.weight(.semibold))
                                    Spacer()
                                    StatusPill(
                                        text: ticket.status == "open" ? "Aberto" : "Resolvido",
                                        color: ticket.status == "open" ? .orange : .green
                                    )
                                }
                                Text(ticket.text)
                                    .font(.footnote)
                                    .foregroundStyle(.secondary)
                                if let createdAt = ticket.createdAt {
                                    Text(createdAt.formatted(date: .abbreviated, time: .shortened))
                                        .font(.caption)
                                        .foregroundStyle(.tertiary)
                                }
                            }
                            .padding(.vertical, 2)
                        }
                    }
                }
            }
            .navigationTitle("Reportar problema")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Fechar") { dismiss() } }
                ToolbarItem(placement: .topBarTrailing) {
                    Button { Task { await store.loadTickets() } } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                }
            }
            .task { await store.loadTickets() }
        }
    }
}

private struct TripExceptionView: View {
    @Environment(\.dismiss) private var dismiss
    let roster: [DriverRosterEntry]
    let save: (TripExceptionType, String, String?) async -> Void

    @State private var type: TripExceptionType = .absence
    @State private var childId = ""
    @State private var note = ""
    @State private var isSaving = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Ocorrência") {
                    Picker("Tipo", selection: $type) {
                        ForEach(TripExceptionType.allCases) { item in Text(item.title).tag(item) }
                    }
                    if !roster.isEmpty {
                        Picker("Aluno (opcional)", selection: $childId) {
                            Text("Sem aluno específico").tag("")
                            ForEach(roster) { child in Text(child.name).tag(child.id) }
                        }
                    }
                    TextField("Observação", text: $note, axis: .vertical)
                        .lineLimit(3...5)
                }
                Section {
                    Text("A ocorrência é encaminhada à Central do Admin. Telefones e dados financeiros não ficam disponíveis para a motorista.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Registrar ocorrência")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancelar") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isSaving ? "Salvando…" : "Enviar") {
                        isSaving = true
                        Task {
                            await save(type, note.trimmingCharacters(in: .whitespacesAndNewlines), childId.isEmpty ? nil : childId)
                            isSaving = false
                            dismiss()
                        }
                    }
                    .disabled(isSaving)
                }
            }
        }
    }
}
