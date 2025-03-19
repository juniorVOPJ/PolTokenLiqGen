const hre = require("hardhat");
const { parseUnits, formatUnits } = require("ethers");
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// QuickSwap addresses on Polygon
const QUICKSWAP_ROUTER = "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff";
const QUICKSWAP_FACTORY = "0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32";
const USDT = "0xc2132D05D31c914a87C6611C10748AEb04B58e8F"; // USDT on Polygon

const ROUTER_ABI = [
    "function addLiquidity(address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline) external returns (uint amountA, uint amountB, uint liquidity)",
];

const FACTORY_ABI = [
    "function getPair(address tokenA, address tokenB) external view returns (address pair)",
];

const TOKEN_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function balanceOf(address account) external view returns (uint256)",
    "function decimals() external view returns (uint8)",
    "function setPair(address _usdtPair) external",
    "function setExempt(address account, bool status) external",
];

async function question(query) {
    return new Promise(resolve => {
        rl.question(query, resolve);
    });
}

async function findPairAddressFromLogs(receipt) {
    // Procurar pelo evento PairCreated nos logs
    for (const log of receipt.logs) {
        // Verificar se o log é do evento PairCreated
        if (log.topics && log.topics.length >= 3) {
            // O tópico do evento PairCreated
            if (log.topics[0] === '0x0d3648bd0f6ba80134a33ba9275ac585d9d315f0ad8355cddefde31afa28d0e9') {
                // Extrair o endereço do par dos dados
                if (log.data && log.data.length >= 66) {
                    // Os primeiros 32 bytes (66 caracteres incluindo '0x') contêm o endereço do par
                    const pairAddress = '0x' + log.data.slice(26, 66);
                    return pairAddress;
                }
            }
        }
    }
    return null;
}

async function getPairFromFactory(factory, tokenA, tokenB) {
    try {
        return await factory.getPair(tokenA, tokenB);
    } catch (error) {
        console.warn("Erro ao consultar factory:", error.message);
        return null;
    }
}

async function main() {
    const [signer] = await hre.ethers.getSigners();
    console.log("Adicionando liquidez no QuickSwap com a conta:", signer.address);

    const tokenAddress = await question("Digite o endereço do seu token: ");
    const tokenAmountStr = await question("Digite a quantidade do seu token para liquidez: ");
    const usdtAmountStr = await question("Digite a quantidade de USDT para liquidez: ");

    const yourToken = new hre.ethers.Contract(tokenAddress, TOKEN_ABI, signer);
    const usdt = new hre.ethers.Contract(USDT, TOKEN_ABI, signer);
    const router = new hre.ethers.Contract(QUICKSWAP_ROUTER, ROUTER_ABI, signer);
    const factory = new hre.ethers.Contract(QUICKSWAP_FACTORY, FACTORY_ABI, signer);

    const tokenDecimals = await yourToken.decimals();
    const usdtDecimals = await usdt.decimals();

    const tokenAmount = parseUnits(tokenAmountStr, tokenDecimals);
    const usdtAmount = parseUnits(usdtAmountStr, usdtDecimals);

    // Verificar balances
    const tokenBalance = await yourToken.balanceOf(signer.address);
    const usdtBalance = await usdt.balanceOf(signer.address);

    if (tokenBalance < tokenAmount) {
        throw new Error(`Balance do token insuficiente. Você tem ${formatUnits(tokenBalance, tokenDecimals)} tokens, mas tentou adicionar ${tokenAmountStr}`);
    }

    if (usdtBalance < usdtAmount) {
        throw new Error(`Balance de USDT insuficiente. Você tem ${formatUnits(usdtBalance, usdtDecimals)} USDT, mas tentou adicionar ${usdtAmountStr}`);
    }

    // Aprovar tokens
    console.log(`\nAprovando ${tokenAmountStr} tokens para o router do QuickSwap...`);
    const approveTokenTx = await yourToken.approve(QUICKSWAP_ROUTER, tokenAmount);
    await approveTokenTx.wait();
    console.log("Aprovação do seu token concluída!");

    console.log(`\nAprovando ${usdtAmountStr} USDT para o router do QuickSwap...`);
    const approveUsdtTx = await usdt.approve(QUICKSWAP_ROUTER, usdtAmount);
    await approveUsdtTx.wait();
    console.log("Aprovação do USDT concluída!");

    const deadline = Math.floor(Date.now() / 1000) + 60 * 10;

    console.log(`\nAdicionando liquidez no QuickSwap...
    Seu Token: ${tokenAmountStr}
    USDT: ${usdtAmountStr}`);

    try {
        const addLiquidityTx = await router.addLiquidity(
            tokenAddress,
            USDT,
            tokenAmount,
            usdtAmount,
            0,
            0,
            signer.address,
            deadline
        );

        console.log("\nAguardando confirmação...");
        const receipt = await addLiquidityTx.wait();

        console.log(`\nLiquidez adicionada com sucesso no QuickSwap!
        Hash da transação: ${receipt.hash}
        Bloco: ${receipt.blockNumber}`);

        // Tentar obter o endereço do par automaticamente
        console.log("\nBuscando endereço do par automaticamente...");

        // Método 1: Tentar encontrar nos logs da transação
        let pairAddress = await findPairAddressFromLogs(receipt);

        // Método 2: Se não encontrou nos logs, consultar a factory
        if (!pairAddress) {
            console.log("Endereço não encontrado nos logs, consultando a factory...");
            pairAddress = await getPairFromFactory(factory, tokenAddress, USDT);
        }

        // Método 3: Se ainda não encontrou, perguntar ao usuário
        if (!pairAddress || pairAddress === '0x0000000000000000000000000000000000000000') {
            console.log("Não foi possível detectar o endereço do par automaticamente.");
            pairAddress = await question("\nDigite o endereço do par criado (verifique no explorer): ");
        } else {
            console.log(`Endereço do par detectado: ${pairAddress}`);
            const confirm = await question("Confirma este endereço? (s/n): ");
            if (confirm.toLowerCase() !== 's') {
                pairAddress = await question("Digite o endereço correto do par: ");
            }
        }

        // Verificar se o endereço parece válido
        if (!pairAddress || !pairAddress.startsWith('0x') || pairAddress.length !== 42) {
            console.warn("Aviso: O endereço fornecido não parece ser um endereço Ethereum válido.");
            const proceed = await question("Deseja continuar mesmo assim? (s/n): ");
            if (proceed.toLowerCase() !== 's') {
                console.log("Operação cancelada pelo usuário.");
                rl.close();
                return;
            }
        }

        // Registrar par no contrato e isentá-lo
        console.log("\nRegistrando par no contrato...");
        try {
            const setPairTx = await yourToken.setPair(pairAddress);
            await setPairTx.wait();
            console.log("Par registrado com sucesso!");

            const setExemptTx = await yourToken.setExempt(pairAddress, true);
            await setExemptTx.wait();
            console.log("Par isento de restrições de trading!");

            console.log(`\nVocê pode verificar o par no QuickSwap:
            https://info.quickswap.exchange/#/pair/${pairAddress}`);
        } catch (error) {
            console.warn("Aviso: Não foi possível registrar o par no contrato:", error.message);
        }

    } catch (error) {
        console.error("\nErro ao adicionar liquidez:", error.message);
    }

    rl.close();
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });