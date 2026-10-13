#!/usr/bin/env python3
"""Failover do balanceador: tráfego contínuo enquanto um backend é derrubado.

    python3 failover.py https://localhost:8443 --insecure
(rode na máquina que tem acesso ao docker da stack)
"""
import argparse, ssl, subprocess, threading, time, urllib.request
from concurrent.futures import ThreadPoolExecutor

ap = argparse.ArgumentParser(); ap.add_argument('base'); ap.add_argument('--insecure', action='store_true')
ap.add_argument('--seconds', type=int, default=30)
a = ap.parse_args()
ctx = ssl._create_unverified_context() if a.insecure else ssl.create_default_context()
stop, results = time.time() + a.seconds, []

def worker(_):
    while time.time() < stop:
        try:
            with urllib.request.urlopen(a.base + '/health/', context=ctx, timeout=10) as r:
                results.append(r.status)
        except urllib.error.HTTPError as e:
            results.append(e.code)
        except Exception:
            results.append(0)

def chaos():
    time.sleep(a.seconds * 0.2); print('  ⚡ derrubando backend1'); subprocess.run(['docker', 'kill', 'toca-backend1-1'], capture_output=True)
    time.sleep(a.seconds * 0.4); print('  ↻ religando backend1'); subprocess.run(['docker', 'start', 'toca-backend1-1'], capture_output=True)

threading.Thread(target=chaos, daemon=True).start()
with ThreadPoolExecutor(10) as ex:
    list(ex.map(worker, range(10)))
bad = [s for s in results if s != 200]
print(f'  {len(results)} requisições em {a.seconds}s · falhas: {len(bad)} {sorted(set(bad))}')
raise SystemExit(1 if bad else 0)
