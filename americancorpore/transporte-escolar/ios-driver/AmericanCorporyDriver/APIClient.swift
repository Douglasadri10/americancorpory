import Foundation
import FirebaseAuth

enum APIClientError: LocalizedError {
    case signedOut
    case invalidResponse
    case server(String)

    var errorDescription: String? {
        switch self {
        case .signedOut: return "Faça login novamente para sincronizar a viagem."
        case .invalidResponse: return "A plataforma retornou uma resposta inválida."
        case .server(let message): return message
        }
    }
}

actor APIClient {
    static let shared = APIClient()

    func createCheckoutSession(input: CheckoutRequest) async throws -> URL {
        let response: CheckoutResponse = try await request(
            path: "/api/pagar",
            method: "POST",
            body: [
                "responsavelNome": input.guardianName,
                "responsavelUid": input.guardianId,
                "responsavelEmail": input.guardianEmail,
                "criancaNome": input.childName,
                "criancaId": input.childId,
                "valorSemanalCents": input.weeklyCents,
            ],
            requiresAuthentication: false
        )
        guard let url = URL(string: response.url) else { throw APIClientError.invalidResponse }
        return url
    }

    func completePasswordReset() async throws {
        let _: EmptyResponse = try await request(path: "/api/account/complete-password-reset", method: "POST")
    }

    func fetchDriverVehicles() async throws -> [TransportVehicle] {
        let response: VehiclesResponse = try await request(path: "/api/driver/vehicles", method: "GET")
        return response.vehicles.map {
            TransportVehicle(
                id: $0.id,
                name: $0.name,
                driverUid: $0.driverUid,
                isActive: $0.active,
                activeTripId: $0.activeTripId
            )
        }
    }

    func fetchDriverMessages() async throws -> [SupportMessage] {
        let response: AdminMessagesResponse = try await request(path: "/api/driver/messages", method: "GET")
        return response.messages.map {
            SupportMessage(
                id: $0.id,
                senderName: $0.senderName,
                senderRole: $0.senderRole,
                subject: $0.subject,
                text: $0.text,
                status: $0.status,
                createdAt: $0.createdAt.flatMap { ISO8601DateFormatter().date(from: $0) }
            )
        }
    }

    func sendDriverMessage(subject: String, text: String) async throws {
        let _: EmptyResponse = try await request(
            path: "/api/driver/messages",
            method: "POST",
            body: ["subject": subject, "text": text]
        )
    }

    func fetchTransportAdminData() async throws -> TransportAdminPayload {
        async let tags: TagsResponse = request(path: "/api/admin/nfc-tags", method: "GET")
        async let vehicles: VehiclesResponse = request(path: "/api/admin/vehicles", method: "GET")
        async let attendance: AttendanceResponse = request(path: "/api/admin/attendance", method: "GET")
        return try await TransportAdminPayload(tags: tags.tags, vehicles: vehicles.vehicles, attendance: attendance.events)
    }

    func fetchAdminMessages() async throws -> [SupportMessage] {
        let response: AdminMessagesResponse = try await request(path: "/api/admin/messages", method: "GET")
        return response.messages.map {
            SupportMessage(
                id: $0.id,
                senderName: $0.senderName,
                senderRole: $0.senderRole,
                subject: $0.subject,
                text: $0.text,
                status: $0.status,
                createdAt: $0.createdAt.flatMap { ISO8601DateFormatter().date(from: $0) }
            )
        }
    }

    func fetchAdminRoutes() async throws -> [TransportRoute] {
        let response: AdminRoutesResponse = try await request(path: "/api/admin/routes", method: "GET")
        return response.routes.map {
            TransportRoute(
                id: $0.id,
                vehicleId: $0.vehicleId,
                vehicleName: $0.vehicleName,
                driverUid: $0.driverUid,
                phase: $0.phase,
                startedAt: $0.startedAt.flatMap { ISO8601DateFormatter().date(from: $0) },
                location: $0.location.map {
                    RouteLocation(
                        latitude: $0.latitude,
                        longitude: $0.longitude,
                        accuracy: $0.accuracy,
                        recordedAt: $0.recordedAt.flatMap { ISO8601DateFormatter().date(from: $0) }
                    )
                }
            )
        }
    }

    func fetchDrivers() async throws -> [AdminDriver] {
        let response: DriversResponse = try await request(path: "/api/admin/drivers", method: "GET")
        return response.drivers.map { payload in
            AdminDriver(
                id: payload.id,
                name: payload.name,
                email: payload.email,
                phone: payload.phone,
                isActive: payload.active,
                licenseStatus: payload.licenseStatus,
                licenseUpdatedAt: payload.licenseUpdatedAt.flatMap { ISO8601DateFormatter().date(from: $0) },
                createdAt: payload.createdAt.flatMap { ISO8601DateFormatter().date(from: $0) }
            )
        }
    }

    func createDriver(name: String, email: String, phone: String) async throws -> (driver: AdminDriver, credentials: DriverCredentials) {
        let response: CreateDriverResponse = try await request(
            path: "/api/admin/drivers",
            method: "POST",
            body: ["name": name, "email": email, "phone": phone]
        )
        return (
            driver: response.driver.model,
            credentials: DriverCredentials(email: response.driver.email, temporaryPassword: response.temporaryPassword)
        )
    }

    func updateDriver(_ driver: AdminDriver, name: String, email: String, phone: String, licenseObjectPath: String? = nil) async throws -> AdminDriver {
        var body: [String: Any] = ["driverId": driver.id, "name": name, "email": email, "phone": phone]
        if let licenseObjectPath { body["licenseObjectPath"] = licenseObjectPath }
        let response: DriverResponse = try await request(path: "/api/admin/drivers", method: "PATCH", body: body)
        return response.driver.model
    }

    func deactivateDriver(_ driver: AdminDriver) async throws {
        let _: EmptyResponse = try await request(
            path: "/api/admin/drivers",
            method: "DELETE",
            body: ["driverId": driver.id]
        )
    }

    func resetDriverPassword(_ driver: AdminDriver) async throws -> DriverCredentials {
        let response: ResetDriverPasswordResponse = try await request(
            path: "/api/admin/drivers",
            method: "PATCH",
            body: ["driverId": driver.id, "action": "resetPassword"]
        )
        return DriverCredentials(
            email: response.credentials.email,
            temporaryPassword: response.credentials.temporaryPassword
        )
    }

    func uploadDriverLicense(driverId: String, imageData: Data) async throws -> String {
        let response: LicenseUploadResponse = try await request(
            path: "/api/admin/drivers/\(driverId)/license-upload",
            method: "POST",
            body: ["contentType": "image/jpeg"]
        )
        guard let url = URL(string: response.uploadUrl) else { throw APIClientError.invalidResponse }
        var upload = URLRequest(url: url)
        upload.httpMethod = "PUT"
        upload.setValue("image/jpeg", forHTTPHeaderField: "Content-Type")
        let (_, uploadResponse) = try await URLSession.shared.upload(for: upload, from: imageData)
        guard let httpResponse = uploadResponse as? HTTPURLResponse, (200...299).contains(httpResponse.statusCode) else {
            throw APIClientError.server("Não foi possível enviar a habilitação privada.")
        }
        return response.objectPath
    }

    func updateAdminMessageStatus(_ messageId: String, status: String) async throws {
        let _: EmptyResponse = try await request(
            path: "/api/admin/messages",
            method: "PATCH",
            body: ["messageId": messageId, "status": status]
        )
    }

    func provisionTag(childId: String, label: String) async throws -> ProvisionedTag {
        let response: CreateTagResponse = try await request(
            path: "/api/admin/nfc-tags",
            method: "POST",
            body: ["childId": childId, "label": label, "deferActivation": true]
        )
        return ProvisionedTag(id: response.tag.id, childId: response.tag.childId, label: response.tag.label, token: response.nfcToken)
    }

    func activateTag(_ tagId: String) async throws {
        let _: EmptyResponse = try await request(
            path: "/api/admin/nfc-tags",
            method: "PATCH",
            body: ["tagId": tagId, "action": "activate"]
        )
    }

    func setTag(_ tagId: String, active: Bool) async throws {
        let _: EmptyResponse = try await request(
            path: "/api/admin/nfc-tags",
            method: "PATCH",
            body: ["tagId": tagId, "active": active]
        )
    }

    func createVehicle(name: String, driverUid: String) async throws {
        let _: EmptyResponse = try await request(
            path: "/api/admin/vehicles",
            method: "POST",
            body: ["name": name, "driverUid": driverUid]
        )
    }

    func startTrip(vehicleId: String, direction: TripDirection) async throws -> DriverTrip {
        let response: StartTripResponse = try await request(
            path: "/api/driver/trips",
            method: "POST",
            body: ["vehicleId": vehicleId, "direction": direction.rawValue]
        )
        return response.trip
    }

    func loadTripRoster(tripId: String) async throws -> [DriverRosterEntry] {
        let response: DriverRosterResponse = try await request(path: "/api/driver/trips/\(tripId)/roster", method: "GET")
        return response.students
    }

    func closeTrip(tripId: String) async throws {
        let _: EmptyResponse = try await request(path: "/api/driver/trips/\(tripId)", method: "PATCH", body: ["close": true])
    }

    func submit(_ operation: QueuedOperation) async throws {
        switch operation.kind {
        case .nfc:
            guard let tagToken = operation.tagToken else { throw APIClientError.invalidResponse }
            let _: EmptyResponse = try await request(
                path: "/api/driver/nfc-events",
                method: "POST",
                body: [
                    "vehicleId": operation.vehicleId,
                    "tagToken": tagToken,
                    "occurredAt": ISO8601DateFormatter().string(from: operation.createdAt),
                ]
            )
        case .location:
            guard let tripId = operation.tripId, let location = operation.location else { throw APIClientError.invalidResponse }
            let _: EmptyResponse = try await request(
                path: "/api/driver/location",
                method: "POST",
                body: [
                    "vehicleId": operation.vehicleId,
                    "tripId": tripId,
                    "location": [
                        "latitude": location.latitude,
                        "longitude": location.longitude,
                        "accuracy": location.accuracy,
                        "recordedAt": location.recordedAt,
                    ],
                ]
            )
        case .phase:
            guard let tripId = operation.tripId, let phase = operation.phase else { throw APIClientError.invalidResponse }
            let _: EmptyResponse = try await request(
                path: "/api/driver/trips/\(tripId)",
                method: "PATCH",
                body: ["phase": phase.rawValue]
            )
        case .closeTrip:
            guard let tripId = operation.tripId else { throw APIClientError.invalidResponse }
            let _: EmptyResponse = try await request(
                path: "/api/driver/trips/\(tripId)",
                method: "PATCH",
                body: ["close": true]
            )
        case .exception:
            guard let tripId = operation.tripId, let type = operation.exceptionType else { throw APIClientError.invalidResponse }
            let _: EmptyResponse = try await request(
                path: "/api/driver/exceptions",
                method: "POST",
                body: [
                    "tripId": tripId,
                    "type": type.rawValue,
                    "note": operation.exceptionNote ?? "",
                    "childId": operation.childId ?? "",
                ]
            )
        }
    }

    private func request<Response: Decodable>(
        path: String,
        method: String,
        body: [String: Any]? = nil,
        requiresAuthentication: Bool = true
    ) async throws -> Response {
        let idToken: String?
        if requiresAuthentication {
            guard let user = Auth.auth().currentUser else { throw APIClientError.signedOut }
            idToken = try await user.getIDToken()
        } else {
            idToken = nil
        }
        let url = AppConfiguration.apiBaseURL.appendingPathComponent(path.trimmingCharacters(in: CharacterSet(charactersIn: "/")))
        var request = URLRequest(url: url)
        request.httpMethod = method
        if let idToken {
            request.setValue("Bearer \(idToken)", forHTTPHeaderField: "Authorization")
        }
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let body {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        }

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else { throw APIClientError.invalidResponse }
        guard (200...299).contains(httpResponse.statusCode) else {
            let error = try? JSONDecoder().decode(ApiErrorResponse.self, from: data)
            throw APIClientError.server(error?.error ?? "Erro \(httpResponse.statusCode) ao sincronizar.")
        }
        return try JSONDecoder().decode(Response.self, from: data)
    }
}

private struct EmptyResponse: Codable {}

struct CheckoutRequest {
    let guardianName: String
    let guardianId: String
    let guardianEmail: String
    let childName: String
    let childId: String
    let weeklyCents: Int
}

private struct CheckoutResponse: Decodable {
    let url: String
}

struct TransportAdminPayload {
    let tags: [TagPayload]
    let vehicles: [VehiclePayload]
    let attendance: [AttendancePayload]
}

struct TagPayload: Decodable {
    let id: String
    let childId: String
    let childName: String
    let label: String
    let active: Bool
    let lastUsedAt: String?
}

struct VehiclePayload: Decodable {
    let id: String
    let name: String
    let driverUid: String
    let active: Bool
    let activeTripId: String?
}

struct AttendancePayload: Decodable {
    let id: String
    let childName: String
    let type: String
    let vehicleId: String
    let occurredAt: String?
}

private struct TagsResponse: Decodable { let tags: [TagPayload] }
private struct VehiclesResponse: Decodable { let vehicles: [VehiclePayload] }
private struct AttendanceResponse: Decodable { let events: [AttendancePayload] }
private struct DriverRosterResponse: Decodable { let students: [DriverRosterEntry] }
private struct AdminMessagesResponse: Decodable { let messages: [AdminMessagePayload] }
private struct AdminRoutesResponse: Decodable { let routes: [AdminRoutePayload] }
private struct DriversResponse: Decodable { let drivers: [AdminDriverPayload] }
private struct DriverResponse: Decodable { let driver: AdminDriverPayload }
private struct CreateDriverResponse: Decodable {
    let driver: AdminDriverPayload
    let temporaryPassword: String
}
private struct LicenseUploadResponse: Decodable {
    let uploadUrl: String
    let objectPath: String
}
private struct ResetDriverPasswordResponse: Decodable {
    let credentials: ResetDriverPasswordPayload
}
private struct ResetDriverPasswordPayload: Decodable {
    let email: String
    let temporaryPassword: String
}

private struct AdminDriverPayload: Decodable {
    let id: String
    let name: String
    let email: String
    let phone: String
    let active: Bool
    let licenseStatus: String
    let licenseUpdatedAt: String?
    let createdAt: String?

    var model: AdminDriver {
        AdminDriver(
            id: id,
            name: name,
            email: email,
            phone: phone,
            isActive: active,
            licenseStatus: licenseStatus,
            licenseUpdatedAt: licenseUpdatedAt.flatMap { ISO8601DateFormatter().date(from: $0) },
            createdAt: createdAt.flatMap { ISO8601DateFormatter().date(from: $0) }
        )
    }
}

private struct AdminMessagePayload: Decodable {
    let id: String
    let senderName: String
    let senderRole: String
    let subject: String
    let text: String
    let status: String
    let createdAt: String?
}

private struct AdminRoutePayload: Decodable {
    let id: String
    let vehicleId: String
    let vehicleName: String
    let driverUid: String
    let phase: String
    let startedAt: String?
    let location: AdminRouteLocationPayload?
}

private struct AdminRouteLocationPayload: Decodable {
    let latitude: Double
    let longitude: Double
    let accuracy: Double?
    let recordedAt: String?
}
struct ProvisionedTag {
    let id: String
    let childId: String
    let label: String
    let token: String
}

private struct CreateTagResponse: Decodable {
    struct Tag: Decodable {
        let id: String
        let childId: String
        let label: String
    }

    let tag: Tag
    let nfcToken: String
}
