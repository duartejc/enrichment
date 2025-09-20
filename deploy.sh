#!/bin/bash

# Deploy script para Prospectiza
# Uso: ./deploy.sh

set -e  # Parar em caso de erro

echo "🚀 Iniciando deploy do Prospectiza..."

# Verificar se estamos no diretório correto
if [ ! -f "package.json" ] && [ ! -d "backend" ] && [ ! -d "web" ]; then
    echo "❌ Erro: Execute este script no diretório raiz do projeto"
    exit 1
fi

# Função para log com timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Fazer backup da versão atual
log "📦 Fazendo backup da versão atual..."
if [ -d "backend/dist" ]; then
    cp -r backend/dist backend/dist.backup.$(date +%Y%m%d_%H%M%S)
    log "✅ Backup criado"
fi

# Atualizar código do repositório
log "📥 Atualizando código do repositório..."
git pull origin main
log "✅ Código atualizado"

# Deploy do Backend
log "🔧 Fazendo deploy do backend..."
cd backend

# Instalar dependências
log "📦 Instalando dependências do backend..."
npm ci --only=production

# Build do projeto
log "🏗️ Fazendo build do backend..."
npm run build

# Voltar para diretório raiz
cd ..

# Deploy do Frontend
log "🎨 Fazendo deploy do frontend..."
cd web

# Instalar dependências
log "📦 Instalando dependências do frontend..."
npm ci

# Build do projeto
log "🏗️ Fazendo build do frontend..."
npm run build

# Voltar para diretório raiz
cd ..

# Reiniciar aplicação com PM2
log "🔄 Reiniciando aplicação..."
if pm2 list | grep -q "prospectiza-backend"; then
    pm2 restart prospectiza-backend
    log "✅ Aplicação reiniciada"
else
    log "🚀 Iniciando aplicação pela primeira vez..."
    pm2 start ecosystem.config.js
    pm2 save
    log "✅ Aplicação iniciada"
fi

# Recarregar Nginx
log "🌐 Recarregando Nginx..."
sudo systemctl reload nginx
log "✅ Nginx recarregado"

# Verificar status
log "📊 Verificando status da aplicação..."
pm2 status

log "🎉 Deploy concluído com sucesso!"
log "🌐 Aplicação disponível em: http://$(curl -s ifconfig.me)"
log "📊 Monitoramento: pm2 monit"
log "📝 Logs: pm2 logs prospectiza-backend"
