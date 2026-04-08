/**
 * VTS Card Reader Bridge — Bahrain Smart Card SDK
 * Calls BH.CIO.Smartcard.IDCardManager.dll directly via PowerShell C#
 * No compilation needed — uses Windows built-in PowerShell Add-Type
 *
 * Run: node bridge.js
 */

const { WebSocketServer } = require('ws');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const WS_PORT = 7070;
const wss = new WebSocketServer({ port: WS_PORT });

console.log(`[VTS] Card reader bridge on ws://localhost:${WS_PORT}`);

function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(c => { if (c.readyState === 1) c.send(msg); });
}

wss.on('connection', ws => {
  console.log('[WS] Browser connected');
  ws.send(JSON.stringify({ type: 'status', status: 'connected' }));
});

// ── Locate the SDK DLL ────────────────────────────────────────
// Checks common locations — update SDK_PATH if yours is elsewhere
const SDK_CANDIDATES = [
  path.join(__dirname, 'sdk', 'BH.CIO.Smartcard.IDCardManager.dll'),
  path.join(__dirname, 'BH.CIO.Smartcard.IDCardManager.dll'),
  'C:\\Program Files\\Bahrain Smart Card SDK\\BH.CIO.Smartcard.IDCardManager.dll',
  'C:\\Program Files (x86)\\Bahrain Smart Card SDK\\BH.CIO.Smartcard.IDCardManager.dll',
  'C:\\BahrainSmartCard\\BH.CIO.Smartcard.IDCardManager.dll',
];

let SDK_PATH = SDK_CANDIDATES.find(p => fs.existsSync(p));

if (!SDK_PATH) {
  // Fallback: search current directory recursively for the DLL
  const found = findFile(__dirname, 'BH.CIO.Smartcard.IDCardManager.dll');
  if (found) SDK_PATH = found;
}

function findFile(dir, name) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { const r = findFile(full, name); if (r) return r; }
      else if (e.name === name) return full;
    }
  } catch {}
  return null;
}

if (SDK_PATH) {
  console.log('[SDK] Found DLL at:', SDK_PATH);
} else {
  console.warn('[SDK] DLL not found — copy the SDK folder next to bridge.js');
  console.warn('[SDK] Expected: card-reader/sdk/BH.CIO.Smartcard.IDCardManager.dll');
}

// ── PowerShell script ─────────────────────────────────────────
function buildScript(dllPath) {
  // Escape backslashes for C# string
  const dllEscaped = dllPath.replace(/\\/g, '\\\\');

  return `
# Load the Bahrain Smart Card SDK
Add-Type -Path "${dllPath.replace(/\\/g, '\\\\')}" -ErrorAction Stop

# Use reflection to discover available types and methods
$assembly = [System.Reflection.Assembly]::LoadFrom("${dllPath.replace(/\\/g, '\\\\')}")
$types = $assembly.GetExportedTypes()

# Find the card manager / reader class
$managerType = $null
foreach ($t in $types) {
    if ($t.Name -like "*IDCard*" -or $t.Name -like "*CardManager*" -or $t.Name -like "*CardReader*") {
        $managerType = $t
        Write-Output "TYPE:$($t.FullName)"
        break
    }
}

if ($managerType -eq $null) {
    # List all types for debugging
    foreach ($t in $types) { Write-Output "AVAILABLE_TYPE:$($t.FullName)" }
    Write-Output "ERROR:NoCardManagerType"
    exit
}

# List all public methods for debugging on first run
$methods = $managerType.GetMethods([System.Reflection.BindingFlags]::Public -bor [System.Reflection.BindingFlags]::Instance -bor [System.Reflection.BindingFlags]::Static)
foreach ($m in $methods) {
    Write-Output "METHOD:$($m.Name)"
}

# Try to instantiate and use the manager
try {
    $manager = [System.Activator]::CreateInstance($managerType)
    Write-Output "READER:SDK Ready"
} catch {
    # Try static usage
    Write-Output "READER:SDK Ready (static)"
    $manager = $null
}

$wasPresent = $false

while ($true) {
    try {
        $cardPresent = $false
        
        # Try common method names to detect card presence
        $detectMethods = @("IsCardPresent","CardPresent","HasCard","IsConnected","GetCardStatus","DetectCard","Connect","Open")
        foreach ($mName in $detectMethods) {
            $m = $managerType.GetMethod($mName)
            if ($m -ne $null) {
                try {
                    if ($m.IsStatic) { $result = $m.Invoke($null, $null) }
                    else { $result = $m.Invoke($manager, $null) }
                    if ($result -eq $true -or $result -eq 1) { $cardPresent = $true }
                    break
                } catch {}
            }
        }
        
        if ($cardPresent -and -not $wasPresent) {
            Write-Output "INSERTED"
            
            # Try common method names to read CPR/ID number
            $cprMethods = @(
                "GetCPR","GetCpr","ReadCPR","ReadCpr",
                "GetIDNumber","GetIdNumber","GetNationalID","GetNationalId",
                "GetPersonalNumber","GetCardNumber",
                "ReadIDCard","ReadCard","GetCardData","ReadData",
                "GetHolderInfo","GetCardInfo","GetInfo"
            )
            
            $cprFound = $false
            foreach ($mName in $cprMethods) {
                $m = $managerType.GetMethod($mName)
                if ($m -ne $null) {
                    try {
                        if ($m.IsStatic) { $result = $m.Invoke($null, $null) }
                        else { $result = $m.Invoke($manager, $null) }
                        
                        if ($result -ne $null) {
                            $str = $result.ToString()
                            # Check if result contains a 9-digit CPR
                            if ($str -match "\d{9}") {
                                Write-Output "CPR:$($Matches[0])"
                                $cprFound = $true
                                break
                            }
                            # If it's an object, check its properties
                            $props = $result.GetType().GetProperties()
                            foreach ($prop in $props) {
                                $val = $prop.GetValue($result)
                                if ($val -ne $null -and $val.ToString() -match "\d{9}") {
                                    Write-Output "PROP:$($prop.Name)=$val"
                                    Write-Output "CPR:$($Matches[0])"
                                    $cprFound = $true
                                    break
                                }
                            }
                            if ($cprFound) { break }
                            # Otherwise log what we got for debugging
                            Write-Output "DEBUG:\${mName}=$str"
                        }
                    } catch {
                        Write-Output "DEBUG_ERR:\${mName}=$($_.Exception.Message)"
                    }
                }
            }
            
            if (-not $cprFound) {
                Write-Output "ERROR:CPRNotFound"
            }
            
            $wasPresent = $true
            
        } elseif (-not $cardPresent -and $wasPresent) {
            Write-Output "REMOVED"
            $wasPresent = $false
        }
        
    } catch {
        Write-Output "ERROR:Loop=$($_.Exception.Message)"
    }
    
    Start-Sleep -Milliseconds 500
}
`;
}

// ── Start bridge ──────────────────────────────────────────────
let psProcess = null;

function startBridge() {
  if (!SDK_PATH) {
    console.error('[BRIDGE] Cannot start — SDK DLL not found.');
    console.error('[BRIDGE] Copy your SDK files to: card-reader/sdk/');
    broadcast({ type: 'error', message: 'SDK DLL not found. Check bridge console.' });
    return;
  }

  const tmpScript = path.join(os.tmpdir(), 'vts_bahrain_sdk.ps1');
  fs.writeFileSync(tmpScript, buildScript(SDK_PATH), 'utf8');
  console.log('[BRIDGE] Starting PowerShell with Bahrain SDK…');

psProcess = spawn('C:\\Windows\\SysWOW64\\WindowsPowerShell\\v1.0\\powershell.exe', [
  '-NoProfile', '-NonInteractive',
  '-ExecutionPolicy', 'Bypass',
  '-File', tmpScript
]);

  let buffer = '';

  psProcess.stdout.on('data', data => {
    buffer += data.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      console.log('[PS]', line);

      if (line.startsWith('TYPE:')) {
        console.log('[SDK] Using class:', line.slice(5));on cpr

      } else if (line.startsWith('METHOD:')) {
        // Log available methods silently for debugging
        process.stdout.write('.');

      } else if (line.startsWith('AVAILABLE_TYPE:')) {
        console.log('[SDK] Found type:', line.slice(15));

      } else if (line.startsWith('READER:')) {
        const name = line.slice(7);
        broadcast({ type: 'reader', name, status: 'connected' });

      } else if (line === 'INSERTED') {
        broadcast({ type: 'card', status: 'reading' });

      } else if (line === 'REMOVED') {
        broadcast({ type: 'card', status: 'removed' });

      } else if (line.startsWith('CPR:')) {
        const cpr = line.slice(4).trim();
        console.log('[CARD] CPR:', cpr);
        broadcast({ type: 'cpr', cpr });

      } else if (line.startsWith('PROP:')) {
        console.log('[SDK] Property found:', line.slice(5));

      } else if (line.startsWith('DEBUG:')) {
        console.log('[DEBUG]', line.slice(6));

      } else if (line.startsWith('DEBUG_ERR:')) {
        console.log('[DEBUG ERR]', line.slice(10));

      } else if (line.startsWith('ERROR:')) {
        const msg = line.slice(6);
        if (msg === 'CPRNotFound') {
          console.log('[CARD] CPR not found — check DEBUG lines above for available data');
          broadcast({ type: 'error', message: 'Card read but CPR not found. Enter manually.' });
        } else if (msg === 'NoCardManagerType') {
          broadcast({ type: 'error', message: 'SDK loaded but no card manager class found.' });
        } else {
          broadcast({ type: 'error', message: 'SDK error: ' + msg });
        }
      }
    }
  });

  psProcess.stderr.on('data', data => {
    const err = data.toString().trim();
    if (err) {
      console.error('[PS ERROR]', err);
      if (err.includes('Could not load') || err.includes('not found')) {
        broadcast({ type: 'error', message: 'Failed to load SDK DLL. Check path.' });
      }
    }
  });

  psProcess.on('exit', code => {
    console.log(`[BRIDGE] Exited (${code}) — restarting in 3s…`);
    setTimeout(startBridge, 3000);
  });
}

startBridge();

process.on('SIGINT', () => {
  console.log('\n[VTS] Shutting down…');
  if (psProcess) psProcess.kill();
  wss.close();
  process.exit(0);
});