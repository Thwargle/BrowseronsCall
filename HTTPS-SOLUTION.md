# 🔒 HTTPS WebSocket Connection Solution

## 🚨 **Problem**
Firefox and other modern browsers are blocking insecure WebSocket connections (`ws://`) when players try to connect from external networks, showing:
```
HTTPS-Only Mode: Upgrading insecure request "ws://173.44.75.134:8080/" to use "wss"
Firefox can't establish a connection to the server at wss://173.44.75.134:8080/
```

## ✅ **Solutions (Choose One)**

### **Option 1: Quick Fix - Use HTTP Only (Recommended for Testing)**
Players can temporarily disable HTTPS-only mode in Firefox:
1. **Firefox**: Go to `about:config` → Search `dom.security.https_only_mode` → Set to `false`
2. **Chrome**: No HTTPS-only mode by default
3. **Edge**: No HTTPS-only mode by default

### **Option 2: Full HTTPS Server (Recommended for Production)**
Run the HTTPS-enabled server with SSL certificates:

#### **Step 1: Generate SSL Certificates**
```powershell
# Run as Administrator
.\generate-certs.ps1
```

#### **Step 2: Start HTTPS Server**
```bash
npm run start:https
```

#### **Step 3: Players Connect to**
- **HTTPS**: `https://173.44.75.134:8443`
- **Secure WebSocket**: `wss://173.44.75.134:8443`

### **Option 3: Use ngrok for Public HTTPS (Easiest)**
Create a secure tunnel without certificates:

#### **Step 1: Install ngrok**
```bash
winget install ngrok.ngrok
```

#### **Step 2: Create HTTPS Tunnel**
```bash
ngrok http 8080
```

#### **Step 3: Players Use ngrok URL**
- **Game**: `https://abc123.ngrok.io`
- **WebSocket**: `wss://abc123.ngrok.io`

## 🚀 **Immediate Action (Right Now)**

### **For Your Current Server:**
1. **Keep HTTP server running** on port 8080
2. **Tell players to disable HTTPS-only mode** in Firefox
3. **Or use Chrome/Edge** which don't have this restriction

### **For Long-term Solution:**
1. **Generate certificates**: `.\generate-certs.ps1`
2. **Start HTTPS server**: `npm run start:https`
3. **Players connect to**: `https://173.44.75.134:8443`

## 🔧 **Server Commands**

```bash
# Current HTTP server (port 8080)
npm start

# New HTTPS server (port 8443) - after generating certificates
npm run start:https

# Development mode with auto-restart
npm run dev          # HTTP
npm run dev:https    # HTTPS
```

## 🌐 **Connection URLs**

| Server Type | Game URL | WebSocket URL | Port |
|-------------|----------|---------------|------|
| **HTTP** | `http://173.44.75.134:8080` | `ws://173.44.75.134:8080` | 8080 |
| **HTTPS** | `https://173.44.75.134:8443` | `wss://173.44.75.134:8443` | 8443 |
| **ngrok** | `https://abc123.ngrok.io` | `wss://abc123.ngrok.io` | Auto |

## 📱 **Player Instructions**

### **Firefox Users (HTTPS-only mode enabled):**
1. **Option A**: Disable HTTPS-only mode temporarily
   - Go to `about:config`
   - Search `dom.security.https_only_mode`
   - Set to `false`
   - Connect to `http://173.44.75.134:8080`

2. **Option B**: Use HTTPS server
   - Connect to `https://173.44.75.134:8443`
   - Accept self-signed certificate warning

### **Chrome/Edge Users:**
- Connect directly to `http://173.44.75.134:8080`
- No HTTPS restrictions

## 🎯 **Recommended Next Steps**

1. **Immediate**: Tell players to disable HTTPS-only mode in Firefox
2. **Short-term**: Generate SSL certificates and run HTTPS server
3. **Long-term**: Consider using ngrok for public hosting

## 🔍 **Troubleshooting**

### **Certificate Errors:**
- Accept self-signed certificate warnings in browser
- Ensure `server-cert.pem` and `server-key.pem` exist

### **Port Issues:**
- Forward both ports 8080 (HTTP) and 8443 (HTTPS) on router
- Check firewall settings

### **Connection Refused:**
- Verify server is running: `netstat -ano | findstr :8080`
- Check if HTTPS server is running: `netstat -ano | findstr :8443`
