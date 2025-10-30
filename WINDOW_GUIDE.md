# How to Run `make start` on Windows

If you're using Windows and don't have `make` installed, you can follow one of the options below to set it up.

---

## Install `make` on Windows

If you prefer to use the same `make` commands as on macOS/Linux, you can easily install it on Windows in one of the following ways:

---

### 🧰 Option A — Using Chocolatey

1. Open **PowerShell as Administrator**.
2. If you don’t have Chocolatey yet, install it with:
   ```powershell
   Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
   ```
3. Then install `make`:
   ```powershell
   choco install make
   ```
4. Close and reopen PowerShell, then verify:
   ```powershell
   make --version
   ```

---

### 🧩 Option B — Using Git Bash

1. Install **Git for Windows** from [https://git-scm.com/download/win](https://git-scm.com/download/win).
2. During installation, enable the option to use **Git Bash**.
3. Open Git Bash and verify:
   ```bash
   make --version
   ```
4. You can now run:
   ```bash
   make start
   ```

---

✅ Once installed using any of the above methods, you can run:

```bash
make start
```

and proceed with the normal setup and testing workflow.
