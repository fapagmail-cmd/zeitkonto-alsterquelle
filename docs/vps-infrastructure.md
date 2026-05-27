# Server-Infrastruktur & Docker-Konfiguration (Strato VPS)

Dieses Dokument dient als persistente Referenz für die Konfiguration des Strato VPS Linux VC4-8 Servers. Es hilft Entwicklern und KI-Agenten, die bestehende Struktur schnell zu verstehen und neue Dienste ohne Konflikte zu integrieren.

## 🖥️ Server-Spezifikationen

* **Host:** STRATO VPS Linux VC4-8 (Ubuntu 24.04.4 LTS)
* **Verbindung:** SSH-Zugriff per Shortcut `ssh strato-vps` (ED25519 SSH-Key für `root`)
* **Standard-Pfad für Docker-Projekte:** `/opt/` (z. B. `/opt/zeitkonto`)

---

## 🛠️ Bestehende Docker-Container & Portbelegung

Alle Dienste laufen isoliert in Docker-Containern und werden über den Nginx Proxy Manager geroutet.

| Dienst / Container | Interner Port | Externer Port (Host) | Zweck / Beschreibung |
| :--- | :--- | :--- | :--- |
| **`nginx-proxy-manager`** | `80`, `81`, `443` | `80`, `81`, `443` | Reverse Proxy, SSL-Verwaltung (Let's Encrypt), Web-Routing |
| **`n8n-app`** | `5678` | `5678` | Workflow-Automatisierung |
| **`zeitkonto-app`** | `3000` | `3000` | Hausmeister-Zeiterfassung |
| *Geplant:* **`hermes-agent`** | *tbd* | *tbd (z. B. 8080)* | Autonomer KI-Agent |

---

## 📂 Verzeichnisstruktur auf dem VPS

Um Konflikte zu vermeiden und Backups zu vereinfachen, hat jedes Projekt ein eigenes Verzeichnis unter `/opt/` mit eigener `docker-compose.yml`:

```text
/opt/
├── nginx-proxy-manager/  # Nginx Proxy Manager Konfigurationen
├── n8n/                 # n8n Automatisierungs-Setups
├── zeitkonto/           # Zeiterfassungs-App (Dieses Projekt)
│   ├── data/            # Persistierte Zeiteinträge (entries.json)
│   ├── docker-compose.yml
│   └── Dockerfile
└── hermes-agent/        # (Geplantes Projekt für den Hermes Agenten)
```

---

## 🔒 Sicherheits- & Routing-Regeln für neue Container

Wenn ein neuer Container (wie der **Hermes Agent**) hinzugefügt wird, müssen folgende Regeln beachtet werden:

1. **Keine Port-Konflikte:** Der Host-Port in der `ports`-Sektion der `docker-compose.yml` darf noch nicht belegt sein (z. B. nicht Port 3000 oder 5678 nutzen).
2. **Daten-Persistenz:** Datenbanken oder JSON-Dateien müssen immer über Volumes auf den Host gemountet werden (z. B. `./data:/app/data`), um Datenverlust bei Container-Updates zu verhindern.
3. **SSL-Routing:** Neue Web-Oberflächen nicht unverschlüsselt direkt nach außen freigeben. Stattdessen im Nginx Proxy Manager (Port 81) einen Proxy-Host mit SSL (HTTPS) einrichten, der intern auf den entsprechenden Port weiterleitet.
