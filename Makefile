.PHONY: help local local-data local-reset local-off

help: ## Lista los comandos disponibles
	@grep -E '^[a-zA-Z_-]+:.*##' Makefile | awk 'BEGIN {FS = ":.*##"}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

local: local-data ## Activa el modo local (sin Google): datos de ejemplo + VITE_MODO_LOCAL=true
	@grep -qs '^VITE_MODO_LOCAL=true' .env.local 2>/dev/null || echo 'VITE_MODO_LOCAL=true' >> .env.local
	@echo "Modo local listo. Arranca con: npm run dev"

local-data: ## Genera local-data/cuentas-pareja.json con datos de ejemplo si no existe
	@bash scripts/generar-datos-locales.sh

local-reset: ## Borra y regenera los datos locales de ejemplo
	@bash scripts/generar-datos-locales.sh --forzar

local-off: ## Vuelve a usar Google (desactiva el modo local)
	@rm -f .env.local
	@echo "Modo local desactivado. Arranca con: npm run dev (pedirá login de Google)"
