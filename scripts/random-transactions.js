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

// Função para selecionar aleatoriamente um elemento de um array
function getRandomElement(array) {
    return array[Math.floor(Math.random() * array.length)];
}

// Função para gerar um valor aleatório dentro de um intervalo
function getRandomAmount(min, max) {
    return Math.random() * (max - min) + min;
}

async function main() {
    console.log("=== Simulador de Transações Aleatórias entre Carteiras ===\n");

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

    // Solicitar endereço do token
    const tokenAddress = await question("Digite o endereço do token: ");

    // Configurar parâmetros de simulação
    const transactionCount = parseInt(await question("Digite o número de transações a simular: "));
    if (isNaN(transactionCount) || transactionCount <= 0) {
        console.error("Número inválido de transações!");
        process.exit(1);
    }

    const minAmount = parseFloat(await question("Digite o valor mínimo por transação: "));
    const maxAmount = parseFloat(await question("Digite o valor máximo por transação: "));

    if (isNaN(minAmount) || isNaN(maxAmount) || minAmount <= 0 || maxAmount <= minAmount) {
        console.error("Valores inválidos para mínimo/máximo!");
        process.exit(1);
    }

    // Criar instâncias de carteiras com ethers
    console.log("\nPreparando carteiras...");
    const provider = hre.ethers.provider;

    const ethersWallets = wallets.map(w => new hre.ethers.Wallet(w.privateKey, provider));
    console.log(`Carteiras preparadas: ${ethersWallets.length}`);

    // Criar interface para o token
    const tokenABI = [
        "function transfer(address to, uint256 amount) external returns (bool)",
        "function balanceOf(address account) external view returns (uint256)",
        "function decimals() external view returns (uint8)",
        "function symbol() external view returns (string)"
    ];

    // Conectar ao token com a primeira carteira para obter informações
    const firstWallet = ethersWallets[0];
    const token = new hre.ethers.Contract(tokenAddress, tokenABI, firstWallet);

    try {
        const decimals = await token.decimals();
        const symbol = await token.symbol();
        console.log(`\nToken: ${symbol} (${decimals} decimais)`);

        // Verificar saldos
        console.log("\nVerificando saldos das carteiras...");
        let totalBalance = 0;
        let walletsWithBalance = 0;

        for (let i = 0; i < ethersWallets.length; i++) {
            const balance = await token.balanceOf(ethersWallets[i].address);
            const balanceFormatted = parseFloat(formatUnits(balance, decimals));
            totalBalance += balanceFormatted;

            if (balanceFormatted > 0) {
                walletsWithBalance++;
            }

            if (i < 5 || i >= ethersWallets.length - 5) {
                console.log(`Carteira ${i + 1}: ${ethersWallets[i].address} - ${balanceFormatted} ${symbol}`);
            } else if (i === 5) {
                console.log("...");
            }
        }

        console.log(`\nResumo dos saldos:
        - Total de carteiras: ${ethersWallets.length}
        - Carteiras com saldo: ${walletsWithBalance}
        - Saldo total: ${totalBalance} ${symbol}
        `);

        if (walletsWithBalance === 0) {
            console.error("Nenhuma carteira tem saldo! Distribua tokens primeiro.");
            process.exit(1);
        }

        // Confirmar simulação
        const confirm = await question(`Iniciar simulação de ${transactionCount} transações aleatórias? (s/n): `);
        if (confirm.toLowerCase() !== 's') {
            console.log("Simulação cancelada pelo usuário.");
            process.exit(0);
        }

        // Executar transações aleatórias
        console.log("\nIniciando simulação de transações...");

        const transactions = [];
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < transactionCount; i++) {
            // Selecionar carteira de origem aleatória (com saldo)
            let fromWallet;
            let fromBalance;
            let attempts = 0;

            do {
                fromWallet = getRandomElement(ethersWallets);
                fromBalance = await token.balanceOf(fromWallet.address);
                attempts++;

                // Evitar loop infinito
                if (attempts > 50) {
                    console.error("Não foi possível encontrar carteira com saldo após 50 tentativas");
                    break;
                }
            } while (fromBalance.isZero());

            if (fromBalance.isZero()) {
                console.log(`⚠️ Pulando transação ${i + 1}: Não foi possível encontrar carteira com saldo`);
                failCount++;
                continue;
            }

            // Selecionar carteira de destino aleatória (diferente da origem)
            let toWallet;
            do {
                toWallet = getRandomElement(ethersWallets);
            } while (toWallet.address === fromWallet.address);

            // Gerar valor aleatório (não maior que o saldo disponível)
            const maxPossibleAmount = Math.min(
                maxAmount,
                parseFloat(formatUnits(fromBalance, decimals)) * 0.95 // 95% do saldo para deixar para gas
            );

            if (maxPossibleAmount < minAmount) {
                console.log(`⚠️ Pulando transação ${i + 1}: Saldo insuficiente`);
                failCount++;
                continue;
            }

            const randomAmount = getRandomAmount(
                Math.min(minAmount, maxPossibleAmount),
                maxPossibleAmount
            );

            const amount = parseUnits(randomAmount.toFixed(6), decimals);

            // Conectar ao token com a carteira de origem
            const tokenWithSigner = token.connect(fromWallet);

            try {
                console.log(`\nTransação ${i + 1}/${transactionCount}:`);
                console.log(`De: ${fromWallet.address}`);
                console.log(`Para: ${toWallet.address}`);
                console.log(`Valor: ${formatUnits(amount, decimals)} ${symbol}`);

                const tx = await tokenWithSigner.transfer(toWallet.address, amount);
                console.log(`Enviado. Hash: ${tx.hash}`);

                const receipt = await tx.wait();
                console.log(`✅ Confirmado no bloco ${receipt.blockNumber}`);

                transactions.push({
                    from: fromWallet.address,
                    to: toWallet.address,
                    amount: formatUnits(amount, decimals),
                    txHash: receipt.hash,
                    blockNumber: receipt.blockNumber,
                    status: "success"
                });

                successCount++;

            } catch (error) {
                console.error(`❌ Erro na transação: ${error.message}`);

                transactions.push({
                    from: fromWallet.address,
                    to: toWallet.address,
                    amount: formatUnits(amount, decimals),
                    error: error.message,
                    status: "failed"
                });

                failCount++;
            }

            // Mostrar progresso
            console.log(`Progresso: ${i + 1}/${transactionCount} (${((i + 1) / transactionCount * 100).toFixed(1)}%)`);

            // Pequena pausa aleatória entre transações
            const delay = Math.floor(Math.random() * 2000) + 1000; // 1-3 segundos
            await new Promise(resolve => setTimeout(resolve, delay));
        }

        // Salvar relatório de transações
        const reportDir = path.join(__dirname, '..', 'reports');
        if (!fs.existsSync(reportDir)) {
            fs.mkdirSync(reportDir, { recursive: true });
        }

        const reportFile = path.join(reportDir, `random_transactions_${Date.now()}.json`);
        const report = {
            token: {
                address: tokenAddress,
                symbol: symbol,
                decimals: decimals
            },
            simulation: {
                timestamp: new Date().toISOString(),
                totalTransactions: transactionCount,
                successful: successCount,
                failed: failCount,
                transactions: transactions
            }
        };

        fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

        console.log(`\n✅ Simulação concluída!
        - Total de transações: ${transactionCount}
        - Sucesso: ${successCount}
        - Falhas: ${failCount}
        - Relatório salvo em: ${reportFile}
        `);

    } catch (error) {
        console.error("Erro ao interagir com o token:", error);
    }

    rl.close();
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Erro durante a execução:", error);
        process.exit(1);
    });