import { useEffect, useRef, useState } from "react";
import { registrarCheckIn, registrarCheckOut } from "@/services/firebaseService";

type LatLng = { lat: number; lng: number };
type GoogleMapsNamespace = {
    maps: {
        Map: new (
            element: HTMLElement,
            options: { center: LatLng; zoom: number }
        ) => unknown;
        Marker: new (options: {
            position: LatLng;
            map: unknown;
            label?: string;
            title?: string;
        }) => unknown;
    };
};

declare global {
    interface Window {
        google?: GoogleMapsNamespace;
    }
}

// Coordenadas fixas da escola: 7525 Westpointe Blvd, Orlando, FL 32835
const pontoDeParada: LatLng & { nome: string } = {
    nome: "Escola Central",
    lat: 28.519812,
    lng: -81.493600
};

// Raio permitido em pés (ex: 500 pés ≈ 152 metros)
const RAIO_PERMITIDO = 500;

// Função para calcular distância em milhas e pés
function calcularDistanciaMilhasPes(pos1: LatLng, pos2: LatLng) {
    const R = 3958.8; // Raio da Terra em milhas
    const toRad = (deg: number) => (deg * Math.PI) / 180;

    const dLat = toRad(pos2.lat - pos1.lat);
    const dLng = toRad(pos2.lng - pos1.lng);

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(pos1.lat)) *
        Math.cos(toRad(pos2.lat)) *
        Math.sin(dLng / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanciaMilhas = R * c;
    const distanciaPes = distanciaMilhas * 5280;

    return { milhas: distanciaMilhas, pes: distanciaPes };
}

export default function MapView() {
    const mapRef = useRef<HTMLDivElement>(null);
    const [distancia, setDistancia] = useState<number | null>(null);
    const [dentroDaArea, setDentroDaArea] = useState(false);
    const [localAtual, setLocalAtual] = useState<LatLng | null>(null);
    const [status, setStatus] = useState("");
    useEffect(() => {
        const googleMaps = window.google;
        if (!googleMaps || !mapRef.current) return;

        const mapa = new googleMaps.maps.Map(mapRef.current, {
            center: pontoDeParada,
            zoom: 17,
        });

        new googleMaps.maps.Marker({
            position: pontoDeParada,
            map: mapa,
            label: "📍",
            title: pontoDeParada.nome,
        });

        const watchId = navigator.geolocation.watchPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;
                const posicaoAtual = { lat: latitude, lng: longitude };

                new googleMaps.maps.Marker({
                    position: posicaoAtual,
                    map: mapa,
                    label: "👤",
                    title: "Você",
                });

                setLocalAtual(posicaoAtual);

                const { pes } = calcularDistanciaMilhasPes(posicaoAtual, pontoDeParada);
                setDistancia(pes);
                setDentroDaArea(pes <= RAIO_PERMITIDO);
            },
            (err) => {
                console.error("Erro ao capturar localização:", err);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0,
            }
        );

        return () => {
            navigator.geolocation.clearWatch(watchId);
        };
    }, []);



    const handleCheck = async (tipo: "in" | "out") => {
        if (!localAtual) return;
        setStatus("Registrando...");

        try {
            if (tipo === "in") {
                await registrarCheckIn("ID_DA_CRIANCA", localAtual);
                setStatus("✅ Check-in registrado!");
            } else {
                await registrarCheckOut("ID_DA_CRIANCA", localAtual);
                setStatus("✅ Check-out registrado!");
            }
        } catch (err) {
            console.error(err);
            setStatus("❌ Erro ao registrar.");
        }
    };

    return (
        <div>
            <div
                ref={mapRef}
                className="w-full h-[400px] rounded-lg border border-gray-300 mb-4"
            />

            {distancia && (
                <p className="mb-2">
                    Você está a <strong>{distancia.toFixed(0)} pés</strong> do ponto de parada.
                </p>
            )}

            <div className="flex gap-4">
                <button
                    onClick={() => handleCheck("in")}
                    disabled={!dentroDaArea}
                    className={`px-4 py-2 rounded text-white ${dentroDaArea
                        ? "bg-green-600 hover:bg-green-700"
                        : "bg-gray-400 cursor-not-allowed"
                        }`}
                >
                    Check-in
                </button>

                <button
                    onClick={() => handleCheck("out")}
                    disabled={!dentroDaArea}
                    className={`px-4 py-2 rounded text-white ${dentroDaArea
                        ? "bg-blue-600 hover:bg-blue-700"
                        : "bg-gray-400 cursor-not-allowed"
                        }`}
                >
                    Check-out
                </button>
            </div>

            {status && <p className="mt-3">{status}</p>}
        </div>
    );
}
