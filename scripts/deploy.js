const hre = require("hardhat");
const { parseUnits } = require("ethers");
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function question(query) {
    return new Promise(resolve => {
        rl.question(query, resolve);
    });
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function verifyContract(address, constructorArgs, attempts = 5) {
    for (let i = 0; i < attempts; i++) {
        try {
            console.log(`\nTentativa ${i + 1} de verificação...`);
            await hre.run("verify:verify", {
                address: address,
                constructorArguments: constructorArgs,
            });
            console.log("\nContrato verificado com sucesso!");
            return true;
        } catch (e) {
            if (i < attempts - 1) {
                console.log("Aguardando 30 segundos antes da próxima tentativa...");
                await sleep(30000); // Espera 30 segundos
            } else {
                console.log("\nErro na verificação após todas as tentativas:", e.message);
            }
        }
    }
    return false;
}

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    // Carregar configurações do token
    const configPath = path.join(__dirname, '..', 'token-config.json');

    if (!fs.existsSync(configPath)) {
        console.error("Arquivo de configuração não encontrado. Execute 'npm run contract' primeiro.");
        process.exit(1);
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    console.log(`\nInformações do token carregadas:`);
    console.log(`Nome: ${config.tokenName}`);
    console.log(`Símbolo: ${config.tokenSymbol}`);
    console.log(`Decimais: ${config.tokenDecimals}`);
    console.log(`Supply Inicial: ${config.initialSupply}`);
    console.log(`Contrato: ${config.contractName}`);

    const confirm = await question("\nConfirma o deploy na rede Polygon com estas informações? (s/n): ");
    if (confirm.toLowerCase() !== 's') {
        console.log("Deploy cancelado.");
        process.exit(0);
    }

    // Correção aqui: parseUnits espera um número para decimais, não uma string
    const decimals = parseInt(config.tokenDecimals);
    const supply = parseUnits(config.initialSupply, decimals);

    // Deploy do contrato
    console.log("\nDeployando token na Polygon...");
    try {
        const Token = await hre.ethers.getContractFactory(config.contractName);
        const token = await Token.deploy(config.tokenName, config.tokenSymbol, supply);

        console.log("Aguardando confirmação da transação...");
        await token.deploymentTransaction().wait();

        // Obter endereço do contrato
        const tokenAddress = await token.getAddress();
        console.log(`\nToken deployado em: ${tokenAddress}`);

        // Atualizar o arquivo de configuração com o endereço do contrato
        config.contractAddress = tokenAddress;
        config.deployTimestamp = new Date().toISOString();
        config.network = "polygon";
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

        // Aguarda alguns blocos para garantir que o contrato está indexado
        console.log("\nAguardando 5 blocos para confirmação...");
        await token.deploymentTransaction().wait(5); // Aguarda 5 blocos

        // Verificação do contrato com múltiplas tentativas
        await verifyContract(tokenAddress, [config.tokenName, config.tokenSymbol, supply]);

        console.log(`\nPróximos passos:
        1. Use o script de mint para criar tokens adicionais
        2. Use o script de liquidez para adicionar liquidez no QuickSwap
        3. Use o menu do script de mint para gerenciar o token

        Endereço do contrato: ${tokenAddress}
        `);
    } catch (error) {
        console.error("\nErro durante o deploy:");
        console.error(error);

        // Fornecer informações de depuração adicionais
        if (error.message.includes("cannot estimate gas")) {
            console.log("\nDica: O erro pode estar relacionado à estimativa de gás. Verifique se:");
            console.log("1. O contrato está compilando corretamente");
            console.log("2. Os argumentos do construtor estão corretos");
            console.log("3. Você tem saldo suficiente para o deploy");
        }

        if (error.message.includes("contract not found")) {
            console.log("\nDica: O contrato não foi encontrado. Verifique se:");
            console.log(`1. O arquivo contracts/${config.contractName}.sol existe`);
            console.log("2. O nome do contrato no arquivo corresponde a", config.contractName);
            console.log("3. O contrato foi compilado com sucesso");

            // Listar arquivos no diretório contracts
            console.log("\nArquivos no diretório contracts:");
            try {
                const files = fs.readdirSync(path.join(__dirname, '..', 'contracts'));
                files.forEach(file => console.log(`- ${file}`));
            } catch (e) {
                console.log("Não foi possível listar os arquivos:", e.message);
            }
        }
    }

    rl.close();
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });