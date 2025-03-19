const hre = require("hardhat");
const { parseUnits, formatUnits } = require("ethers");
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const crypto = require('crypto');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const TOKEN_ABI = [
    "function allocateProtocolReserves(address to, uint256 amount) external",
    "function balanceOf(address account) external view returns (uint256)",
    "function decimals() external view returns (uint8)",
    "function symbol() external view returns (string)"
];

async function question(query) {
    return new Promise(resolve => {
        rl.question(query, resolve);
    });
}

// Função para descriptografar dados
function decrypt(encryptedData, iv, password) {
    try {
        const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(password, 'hex'), Buffer.from(iv, 'hex'));
        let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return JSON.parse(decrypted);
    } catch (error) {
        console.error("Erro ao descriptografar dados. A senha pode estar incorreta.");
        throw error;
    }
}

// Função para gerar um valor aleatório dentro de um intervalo
function getRandomAmount(min, max) {
    return Math.random() * (max - min) + min;
}

async function main() {
    console.log("=== Distribuição de Tokens para Múltiplas Carteiras ===\n");

    // Carregar configurações do token
    let tokenAddress = "";
    const configPath = path.join(__dirname, '..', 'token-config.json');

    if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (config.contractAddress) {
            tokenAddress = config.contractAddress;
            console.log(`Endereço do token carregado da configuração: ${tokenAddress}`);
        }
    }

    if (!tokenAddress) {
        tokenAddress = await question("Digite o endereço do token: ");
    }

    // Solicitar arquivo de carteiras
    const walletsFile = await question("Digite o caminho para o arquivo de carteiras: ");
    if (!fs.existsSync(walletsFile)) {
        console.error("Arquivo de carteiras não encontrado!");
        process.exit(1);
    }

    // Solicitar arquivo de senha
    const passwordFile = await question("Digite o caminho para o arquivo de chave de criptografia: ");
    if (!fs.existsSync(passwordFile)) {
        console.error("Arquivo de chave não encontrado!");
        process.exit(1);
    }

    // Carregar e descriptografar carteiras
    const walletsData = JSON.parse(fs.readFileSync(walletsFile, 'utf8'));
    const encryptionPassword = fs.readFileSync(passwordFile, 'utf8').trim();

    console.log(`\nDescriptografando ${walletsData.count} carteiras...`);
    const wallets = decrypt(walletsData.data, walletsData.iv, encryptionPassword);
    console.log(`Carteiras carregadas com sucesso: ${wallets.length} endereços`);

    // Conectar ao contrato do token
    const [signer] = await hre.ethers.getSigners();
    const token = new hre.ethers.Contract(tokenAddress, TOKEN_ABI, signer);
    const decimals = await token.decimals();
    const symbol = await token.symbol();

    console.log(`\nToken: ${symbol} (${decimals} decimais)`);
    console.log(`Distribuindo a partir da conta: ${signer.address}`);

    // Configurar parâmetros de distribuição
    const minAmount = parseFloat(await question("Digite o valor mínimo de tokens por carteira: "));
    const maxAmount = parseFloat(await question("Digite o valor máximo de tokens por carteira: "));

    if (isNaN(minAmount) || isNaN(maxAmount) || minAmount <= 0 || maxAmount <= minAmount) {
        console.error("Valores inválidos para mínimo/máximo!");
        process.exit(1);
    }

    // Confirmar distribuição
    const totalMin = minAmount * wallets.length;
    const totalMax = maxAmount * wallets.length;
    console.log(`\nResumo da distribuição:
    - Carteiras: ${wallets.length}
    - Valor mínimo por carteira: ${minAmount} ${symbol}
    - Valor máximo por carteira: ${maxAmount} ${symbol}
    - Total estimado: entre ${totalMin} e ${totalMax} ${symbol}
    `);

    const confirm = await question("Confirma a distribuição? (s/n): ");
    if (confirm.toLowerCase() !== 's') {
        console.log("Distribuição cancelada pelo usuário.");
        process.exit(0);
    }

    // Executar distribuição
    console.log("\nIniciando distribuição de tokens...");

    const distribution = [];
    let totalDistributed = 0;

    for (let i = 0; i < wallets.length; i++) {
        const randomAmount = getRandomAmount(minAmount, maxAmount);
        const amount = parseUnits(randomAmount.toFixed(6), decimals);

        try {
            console.log(`Enviando ${formatUnits(amount, decimals)} ${symbol} para ${wallets[i].address}...`);
            const tx = await token.allocateProtocolReserves(wallets[i].address, amount);
            const receipt = await tx.wait();

            distribution.push({
                address: wallets[i].address,
                amount: formatUnits(amount, decimals),
                txHash: receipt.hash
            });

            totalDistributed += parseFloat(formatUnits(amount, decimals));
            console.log(`✅ Transação confirmada: ${receipt.hash}`);

        } catch (error) {
            console.error(`❌ Erro ao enviar para ${wallets[i].address}: ${error.message}`);
            distribution.push({
                address: wallets[i].address,
                amount: formatUnits(amount, decimals),
                error: error.message
            });
        }

        // Mostrar progresso
        console.log(`Progresso: ${i + 1}/${wallets.length} (${((i + 1) / wallets.length * 100).toFixed(1)}%)`);

        // Pequena pausa entre transações para evitar sobrecarga da rede
        if (i < wallets.length - 1) {
            const delay = Math.floor(Math.random() * 1000) + 500; // 500-1500ms
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    // Salvar relatório de distribuição
    const reportDir = path.join(__dirname, '..', 'reports');
    if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
    }

    const reportFile = path.join(reportDir, `distribution_${Date.now()}.json`);
    const report = {
        token: {
            address: tokenAddress,
            symbol: symbol,
            decimals: decimals
        },
        distribution: {
            timestamp: new Date().toISOString(),
            walletCount: wallets.length,
            totalDistributed: totalDistributed,
            transactions: distribution
        }
    };

    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

    console.log(`\n✅ Distribuição concluída!
    - Total de carteiras: ${wallets.length}
    - Total distribuído: ${totalDistributed} ${symbol}
    - Relatório salvo em: ${reportFile}
    `);

    rl.close();
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Erro durante a execução:", error);
        process.exit(1);
    });