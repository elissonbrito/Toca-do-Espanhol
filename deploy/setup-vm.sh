#!/usr/bin/env bash
# Prepara uma VM Ubuntu (Oracle Always Free, x86 ou ARM) para a produção.
# Rode UMA vez, como ubuntu com sudo:   bash setup-vm.sh
set -euo pipefail

echo "==> Atualizações automáticas de segurança"
sudo apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
  ca-certificates curl unattended-upgrades fail2ban iptables-persistent >/dev/null
sudo dpkg-reconfigure -f noninteractive unattended-upgrades

echo "==> Docker"
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
fi
# Logs do Docker com limite (não enche o disco).
echo '{"log-driver":"json-file","log-opts":{"max-size":"10m","max-file":"5"}}' \
  | sudo tee /etc/docker/daemon.json >/dev/null
sudo systemctl restart docker

echo "==> Swap (2 GB) se não existir"
if ! swapon --show | grep -q .; then
  sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
  sudo mkswap /swapfile >/dev/null && sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

echo "==> Firewall da VM: só 22, 80, 443 (Postgres NÃO é exposto)"
# As imagens Ubuntu da Oracle rejeitam tudo no fim da cadeia INPUT; abrimos 80/443 antes disso.
for p in 80 443; do
  sudo iptables -C INPUT -p tcp --dport $p -j ACCEPT 2>/dev/null \
    || sudo iptables -I INPUT 5 -p tcp -m state --state NEW --dport $p -j ACCEPT
done
sudo iptables -C INPUT -p udp --dport 443 -j ACCEPT 2>/dev/null \
  || sudo iptables -I INPUT 5 -p udp --dport 443 -j ACCEPT
sudo netfilter-persistent save >/dev/null

echo "==> SSH: só chave, sem senha, sem root"
sudo tee /etc/ssh/sshd_config.d/99-hardening.conf >/dev/null <<'CONF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
MaxAuthTries 3
CONF
sudo systemctl reload ssh || sudo systemctl reload sshd

echo "==> fail2ban (bloqueia força bruta no SSH)"
sudo tee /etc/fail2ban/jail.d/sshd.local >/dev/null <<'CONF'
[sshd]
enabled = true
maxretry = 5
bantime = 1h
CONF
sudo systemctl enable --now fail2ban >/dev/null
sudo systemctl restart fail2ban

echo
echo "Pronto. Lembre de liberar TCP 80 e 443 (e UDP 443) na Security List da VCN no console da Oracle."
echo "Saia e entre de novo no SSH para o grupo 'docker' valer."
