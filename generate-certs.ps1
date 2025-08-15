# Generate self-signed SSL certificates for HTTPS server
# Run this script as Administrator

Write-Host "Generating self-signed SSL certificates..." -ForegroundColor Green

# Create certificate
$cert = New-SelfSignedCertificate -DnsName "localhost" -CertStoreLocation "cert:\LocalMachine\My" -NotAfter (Get-Date).AddYears(1)

# Export private key
$pwd = ConvertTo-SecureString -String "password" -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath "server-cert.pfx" -Password $pwd

# Export certificate
Export-Certificate -Cert $cert -FilePath "server-cert.cer"

# Convert to PEM format using OpenSSL (if available) or PowerShell
try {
    # Try to use OpenSSL if available
    $opensslPath = Get-Command openssl -ErrorAction SilentlyContinue
    if ($opensslPath) {
        Write-Host "Using OpenSSL to convert certificates..." -ForegroundColor Yellow
        
        # Convert PFX to PEM
        openssl pkcs12 -in server-cert.pfx -out server-cert.pem -clcerts -nokeys -passin pass:password
        openssl pkcs12 -in server-cert.pfx -out server-key.pem -nocerts -nodes -passin pass:password
        
        Write-Host "Certificates converted to PEM format successfully!" -ForegroundColor Green
    } else {
        Write-Host "OpenSSL not found. Using PowerShell conversion..." -ForegroundColor Yellow
        
        # PowerShell conversion (basic)
        $certBytes = $cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)
        [System.IO.File]::WriteAllBytes("server-cert.pem", $certBytes)
        
        # Note: Private key export requires additional steps in PowerShell
        Write-Host "Certificate exported. Private key requires manual export." -ForegroundColor Yellow
        Write-Host "Consider installing OpenSSL for full PEM support." -ForegroundColor Yellow
    }
} catch {
    Write-Host "Error converting certificates: $_" -ForegroundColor Red
}

Write-Host "Certificate generation complete!" -ForegroundColor Green
Write-Host "Files created:" -ForegroundColor Yellow
Write-Host "  - server-cert.pfx (PKCS#12 format)" -ForegroundColor White
Write-Host "  - server-cert.cer (DER format)" -ForegroundColor White
if (Test-Path "server-cert.pem") {
    Write-Host "  - server-cert.pem (PEM format)" -ForegroundColor White
}
if (Test-Path "server-key.pem") {
    Write-Host "  - server-key.pem (PEM format)" -ForegroundColor White
}

Write-Host "`nTo use HTTPS server:" -ForegroundColor Cyan
Write-Host "1. Ensure server-cert.pem and server-key.pem exist" -ForegroundColor White
Write-Host "2. Run: node Working/js/server-https.js" -ForegroundColor White
Write-Host "3. Connect to: https://localhost:8443" -ForegroundColor White
