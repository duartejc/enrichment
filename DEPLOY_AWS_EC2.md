# 🚀 Deploy do Prospectiza na AWS EC2

Guia completo para publicar o sistema de planilhas colaborativas Prospectiza em uma instância EC2 da AWS com Ubuntu.

## 📋 Pré-requisitos

### 1. Instância EC2
- **OS**: Ubuntu 22.04 LTS ou superior
- **Tipo**: t3.medium ou superior (recomendado para produção)
- **Storage**: 20GB+ SSD
- **Security Group**: Portas 22 (SSH), 80 (HTTP), 443 (HTTPS)

### 2. Domínio (Opcional)
- Domínio próprio apontando para o IP da instância
- Configuração DNS A record

## 🔧 Passo 1: Configuração Inicial da Instância EC2

### 1.1 Conectar via SSH
```bash
ssh -i sua-chave.pem ubuntu@seu-ip-ec2
```

### 1.2 Atualizar Sistema
```bash
sudo apt update && sudo apt upgrade -y
```

### 1.3 Instalar Dependências Básicas
```bash
# Instalar curl, git, build-essential
sudo apt install -y curl git build-essential

# Instalar Node.js 18+ via NodeSource
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verificar instalação
node --version
npm --version
```

### 1.4 Instalar PM2 (Gerenciador de Processos)
```bash
sudo npm install -g pm2
```

### 1.5 Instalar Nginx (Proxy Reverso)
```bash
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

## 📦 Passo 2: Deploy do Código

### 2.1 Clonar o Repositório
```bash
cd /home/ubuntu
git clone https://github.com/seu-usuario/prospectiza.git
cd prospectiza
```

### 2.2 Configurar Backend
```bash
cd backend

# Instalar dependências
npm install

# Criar arquivo de ambiente
sudo nano .env
```

**Conteúdo do .env:**
```env
PORT=3002
NODE_ENV=production
```

```bash
# Build do projeto
npm run build

# Testar se funciona
npm run start:prod
```

### 2.3 Configurar Frontend
```bash
cd ../web

# Instalar dependências
npm install

# Criar arquivo de configuração para produção
sudo nano .env.production
```

**Conteúdo do .env.production:**
```env
VITE_API_BASE_URL=http://seu-dominio-ou-ip
VITE_WS_URL=http://seu-dominio-ou-ip
```

```bash
# Build do projeto
npm run build
```

## 🔄 Passo 3: Configurar PM2

### 3.1 Criar Arquivo de Configuração PM2
```bash
cd /home/ubuntu/prospectiza
sudo nano ecosystem.config.js
```

**Conteúdo do ecosystem.config.js:**
```javascript
module.exports = {
  apps: [
    {
      name: 'prospectiza-backend',
      cwd: './backend',
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3002
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true
    }
  ]
};
```

### 3.2 Iniciar Aplicação com PM2
```bash
# Criar diretório de logs
mkdir -p backend/logs

# Iniciar aplicação
pm2 start ecosystem.config.js

# Salvar configuração PM2
pm2 save

# Configurar PM2 para iniciar no boot
pm2 startup
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u ubuntu --hp /home/ubuntu
```

## 🌐 Passo 4: Configurar Nginx

### 4.1 Criar Configuração do Site
```bash
sudo nano /etc/nginx/sites-available/prospectiza
```

**Conteúdo da configuração:**
```nginx
server {
    listen 80;
    server_name seu-dominio.com www.seu-dominio.com;  # ou seu IP

    # Servir arquivos estáticos do frontend
    root /home/ubuntu/prospectiza/web/dist;
    index index.html;

    # Configuração para SPA (Single Page Application)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy para API do backend
    location /api/ {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Proxy para WebSocket
    location /socket.io/ {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Configurações de cache para assets estáticos
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Configurações de segurança
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
}
```

### 4.2 Ativar Site
```bash
# Criar link simbólico
sudo ln -s /etc/nginx/sites-available/prospectiza /etc/nginx/sites-enabled/

# Remover site padrão
sudo rm /etc/nginx/sites-enabled/default

# Testar configuração
sudo nginx -t

# Reiniciar Nginx
sudo systemctl restart nginx
```

## 🔒 Passo 5: Configurar SSL com Let's Encrypt (Opcional)

### 5.1 Instalar Certbot
```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 5.2 Obter Certificado SSL
```bash
sudo certbot --nginx -d seu-dominio.com -d www.seu-dominio.com
```

### 5.3 Configurar Renovação Automática
```bash
sudo crontab -e
```

Adicionar linha:
```bash
0 12 * * * /usr/bin/certbot renew --quiet
```

## 🔥 Passo 6: Configurar Firewall

```bash
# Configurar UFW
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw status
```

## 📊 Passo 7: Monitoramento e Logs

### 7.1 Comandos PM2 Úteis
```bash
# Ver status das aplicações
pm2 status

# Ver logs em tempo real
pm2 logs

# Reiniciar aplicação
pm2 restart prospectiza-backend

# Parar aplicação
pm2 stop prospectiza-backend

# Monitoramento
pm2 monit
```

### 7.2 Logs do Nginx
```bash
# Logs de acesso
sudo tail -f /var/log/nginx/access.log

# Logs de erro
sudo tail -f /var/log/nginx/error.log
```

## 🚀 Passo 8: Otimizações de Produção

### 8.1 Configurar Swap (se necessário)
```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 8.2 Otimizar Nginx
```bash
sudo nano /etc/nginx/nginx.conf
```

Adicionar/modificar:
```nginx
worker_processes auto;
worker_connections 1024;

gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
```

### 8.3 Configurar Limites do Sistema
```bash
sudo nano /etc/security/limits.conf
```

Adicionar:
```
ubuntu soft nofile 65536
ubuntu hard nofile 65536
```

## 🔄 Passo 9: Script de Deploy Automático

### 9.1 Criar Script de Deploy
```bash
nano /home/ubuntu/deploy.sh
```

**Conteúdo do deploy.sh:**
```bash
#!/bin/bash

echo "🚀 Iniciando deploy do Prospectiza..."

# Navegar para diretório do projeto
cd /home/ubuntu/prospectiza

# Fazer backup da versão atual
echo "📦 Fazendo backup..."
cp -r backend/dist backend/dist.backup.$(date +%Y%m%d_%H%M%S)

# Atualizar código
echo "📥 Atualizando código..."
git pull origin main

# Backend
echo "🔧 Atualizando backend..."
cd backend
npm install --production
npm run build

# Frontend
echo "🎨 Atualizando frontend..."
cd ../web
npm install
npm run build

# Reiniciar aplicação
echo "🔄 Reiniciando aplicação..."
pm2 restart prospectiza-backend

# Recarregar Nginx
sudo systemctl reload nginx

echo "✅ Deploy concluído com sucesso!"
echo "🌐 Aplicação disponível em: http://seu-dominio.com"
```

```bash
chmod +x /home/ubuntu/deploy.sh
```

## 📋 Checklist Final

- [ ] ✅ Instância EC2 configurada
- [ ] ✅ Node.js 18+ instalado
- [ ] ✅ PM2 instalado e configurado
- [ ] ✅ Nginx instalado e configurado
- [ ] ✅ Código clonado e buildado
- [ ] ✅ Backend rodando na porta 3002
- [ ] ✅ Frontend buildado e servido pelo Nginx
- [ ] ✅ WebSocket funcionando
- [ ] ✅ SSL configurado (opcional)
- [ ] ✅ Firewall configurado
- [ ] ✅ Monitoramento ativo

## 🌐 URLs de Acesso

- **Frontend**: http://seu-dominio.com ou http://seu-ip-ec2
- **API**: http://seu-dominio.com/api
- **WebSocket**: http://seu-dominio.com/socket.io

## 🆘 Troubleshooting

### Problema: Backend não inicia
```bash
# Verificar logs
pm2 logs prospectiza-backend

# Verificar se a porta está em uso
sudo netstat -tlnp | grep :3002

# Reiniciar aplicação
pm2 restart prospectiza-backend
```

### Problema: Frontend não carrega
```bash
# Verificar se arquivos foram buildados
ls -la /home/ubuntu/prospectiza/web/dist/

# Verificar configuração do Nginx
sudo nginx -t

# Verificar logs do Nginx
sudo tail -f /var/log/nginx/error.log
```

### Problema: WebSocket não conecta
```bash
# Verificar se backend está rodando
pm2 status

# Testar conexão WebSocket
curl -I http://localhost:3002/socket.io/

# Verificar configuração do proxy no Nginx
sudo nano /etc/nginx/sites-available/prospectiza
```

## 📞 Suporte

Para problemas específicos:
1. Verificar logs do PM2: `pm2 logs`
2. Verificar logs do Nginx: `sudo tail -f /var/log/nginx/error.log`
3. Verificar status dos serviços: `pm2 status` e `sudo systemctl status nginx`

---

**🎉 Parabéns! Seu sistema Prospectiza está agora rodando em produção na AWS EC2!**
