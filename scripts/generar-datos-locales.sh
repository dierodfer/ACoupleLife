#!/usr/bin/env bash
# Genera local-data/cuentas-pareja.json con datos de ejemplo, para usar el
# modo local (VITE_MODO_LOCAL=true) sin necesitar Google Drive. Invocado
# desde el Makefile (`make local-data` / `make local-reset`).
set -euo pipefail

carpeta="local-data"
archivo="$carpeta/cuentas-pareja.json"

if [ -f "$archivo" ] && [ "${1:-}" != "--forzar" ]; then
  echo "$archivo ya existe, no se sobrescribe (usa 'make local-reset' para regenerarlo)."
  exit 0
fi

mkdir -p "$carpeta"
anio=$(date +%Y)
ahora=$(date -u +%Y-%m-%dT%H:%M:%SZ)

cat > "$archivo" <<JSON
{
  "version": 1,
  "actualizadoEn": "$ahora",
  "actualizadoPor": "persona1@local.test",
  "personas": [
    { "id": "p1", "nombre": "Persona 1", "email": "persona1@local.test" },
    { "id": "p2", "nombre": "Persona 2", "email": "persona2@local.test" }
  ],
  "recurrentes": [
    { "id": "r1", "personaId": "p1", "concepto": "Internet", "importe": 60, "desde": "$anio-01", "hasta": null, "overrides": {} }
  ],
  "efectivo": [
    { "id": "e1", "personaId": "p2", "importe": 100, "desde": "$anio-01", "hasta": null }
  ],
  "anios": {
    "$anio": {
      "objetivos": {
        "p1": { "importeMensual": 1000, "excepciones": {} },
        "p2": { "importeMensual": 1000, "excepciones": {} }
      },
      "gastos": [
        { "id": "g1", "personaId": "p1", "importe": 42.5, "fecha": "$anio-01-05", "concepto": "Compra" }
      ],
      "transferencias": [
        { "id": "t1", "personaId": "p1", "importe": 200, "fecha": "$anio-01-10" }
      ]
    }
  }
}
JSON

echo "Generado $archivo"
