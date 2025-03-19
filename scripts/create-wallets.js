const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const crypto = require('crypto');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function question(query) {
    return new Promise(resolve => {
        rl.question(query, resolve);
    });
}

// Função para gerar uma senha aleatória para criptografia
function generateRandomPassword() {
    return crypto.randomBytes(32).toString('hex');
}

// Função para criptografar dados
function encrypt(data, password) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(password, 'hex'), iv);
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return {
        iv: iv.toString('hex'),
        encryptedData: encrypted
    };
}

// Função para descriptografar dados
function decrypt(encryptedData, iv, password) {
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(password, 'hex'), Buffer.from(iv, 'hex'));
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
}

async function main() {
    console.log("=== Gerador de Múltiplas Carteiras para Polygon ===\n");

    const walletCount = parseInt(await question("Quantas carteiras você deseja criar? "));
    if (isNaN(walletCount) || walletCount <= 0) {
        console.error("Número inválido de carteiras!");
        process.exit(1);
    }

    console.log(`\nGerando ${walletCount} carteiras...`);

    const wallets = [];
    for (let i = 0; i < walletCount; i++) {
        const wallet = ethers.Wallet.createRandom();
        wallets.push({
            address: wallet.address,
            privateKey: wallet.privateKey,
            mnemonic: wallet.mnemonic?.phrase || "N/A"
        });

        process.stdout.write(`Progresso: ${i + 1}/${walletCount}\r`);
    }
    console.log("\nCarteiras geradas com sucesso!");

    // Criar diretório para armazenar as carteiras
    const walletsDir = path.join(__dirname, '..', 'wallets');
    if (!fs.existsSync(walletsDir)) {
        fs.mkdirSync(walletsDir, { recursive: true });
    }

    // Gerar senha para criptografia
    const encryptionPassword = generateRandomPassword();

    // Salvar carteiras em formato JSON (criptografado)
    const encryptedData = encrypt(wallets, encryptionPassword);
    const walletsData = {
        created: new Date().toISOString(),
        count: walletCount,
        iv: encryptedData.iv,
        data: encryptedData.encryptedData
    };

    const walletsFile = path.join(walletsDir, `polygon_wallets_${Date.now()}.json`);
    fs.writeFileSync(walletsFile, JSON.stringify(walletsData, null, 2));

    // Salvar senha em arquivo separado
    const passwordFile = path.join(walletsDir, `encryption_key_${Date.now()}.txt`);
    fs.writeFileSync(passwordFile, encryptionPassword);

    // Salvar endereços em arquivo de texto simples para fácil acesso
    const addressesFile = path.join(walletsDir, `addresses_${Date.now()}.txt`);
    const addressesList = wallets.map(w => w.address).join('\n');
    fs.writeFileSync(addressesFile, addressesList);

    console.log(`\nArquivos salvos:
    - Carteiras criptografadas: ${walletsFile}
    - Chave de criptografia: ${passwordFile}
    - Lista de endereços: ${addressesFile}
    
IMPORTANTE: Guarde a chave de criptografia em local seguro! Ela é necessária para acessar as chaves privadas.
`);

    // Mostrar algumas estatísticas
    console.log(`\nResumo:
    - Total de carteiras: ${walletCount}
    - Primeira carteira: ${wallets[0].address}
    - Última carteira: ${wallets[walletCount - 1].address}
    `);

    rl.close();
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Erro durante a execução:", error);
        process.exit(1);
    });