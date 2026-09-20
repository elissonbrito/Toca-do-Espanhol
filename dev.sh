#!/bin/bash
# Desenvolvimento local sem Docker

echo "🍖 Toca do Espanhol — Modo Desenvolvimento"
echo ""

# Backend
echo "📦 Configurando backend..."
cd backend

if [ ! -f ".env" ]; then
  cp .env.example .env
  # Override DB host for local dev
  sed -i 's/DB_HOST=db/DB_HOST=localhost/' .env
fi

pip install -r requirements.txt -q

python manage.py migrate
python manage.py seed_data

echo ""
echo "🚀 Iniciando backend em http://localhost:8001 ..."
python manage.py runserver 8001 &
BACKEND_PID=$!

# Frontend
echo ""
echo "📦 Configurando frontend..."
cd ../frontend
npm install --silent

echo ""
echo "🚀 Iniciando frontend em http://localhost:5173 ..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ Serviços rodando!"
echo "   Frontend: http://localhost:5173"
echo "   Backend:  http://localhost:8001"
echo "   Login:    admin@toca.com / 123456"
echo ""
echo "Para encerrar: Ctrl+C"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
wait
