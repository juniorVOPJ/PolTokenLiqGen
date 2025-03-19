const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { ethers } = require('ethers');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function question(query) {
    return new Promise(resolve => {
        rl.question(query, resolve);
    });
}

async function main() {
    console.log("\n=== Preparação de Metadados para Token na Polygon ===\n");
    console.log("INSTRUÇÕES IMPORTANTES:");
    console.log("1. O logo deve ser um PNG de 256x256 pixels");
    console.log("2. O endereço do contrato deve estar no formato checksummed (com letras maiúsculas e minúsculas corretas)");
    console.log("3. Na Polygon, os tokens são exibidos mais rapidamente nos exploradores e interfaces");
    console.log("4. Metadados são processados mais rapidamente em comparação com outras redes\n");

    let tokenAddress = await question("Digite o endereço do contrato do token: ");

    // Verificar e converter para formato checksummed
    try {
        tokenAddress = ethers.getAddress(tokenAddress);
        console.log(`Endereço checksummed: ${tokenAddress}`);
    } catch (error) {
        console.error("Erro: Endereço de contrato inválido!");
        process.exit(1);
    }

    const tokenName = await question("Digite o nome do token: ");
    const tokenSymbol = await question("Digite o símbolo do token: ");
    const tokenDecimals = await question("Digite o número de decimais do token: ");
    const tokenWebsite = await question("Digite o website do token: ");
    const tokenDescription = await question("Digite a descrição do token: ");
    const logoPath = await question("Digite o caminho para o arquivo de logo (PNG 256x256): ");

    // Verificar se o arquivo de logo existe
    if (!fs.existsSync(logoPath)) {
        console.error(`Erro: Arquivo de logo não encontrado em ${logoPath}`);
        process.exit(1);
    }

    // Verificar se o arquivo é PNG
    if (!logoPath.toLowerCase().endsWith('.png')) {
        console.warn("Aviso: O arquivo não parece ser um PNG. Certifique-se de que é um PNG de 256x256 pixels.");
        const proceed = await question("Deseja continuar mesmo assim? (s/n): ");
        if (proceed.toLowerCase() !== 's') {
            process.exit(0);
        }
    }

    // Criar estrutura de diretórios na raiz do projeto
    const projectRoot = path.resolve(__dirname, '..');
    const dirPath = path.join(projectRoot, 'token-metadata', 'polygon', tokenAddress);

    console.log(`\nCriando diretórios em: ${dirPath}`);
    fs.mkdirSync(dirPath, { recursive: true });

    // Copiar logo
    console.log(`Copiando logo de ${logoPath} para ${path.join(dirPath, 'logo.png')}`);
    fs.copyFileSync(logoPath, path.join(dirPath, 'logo.png'));

    // Criar info.json
    const info = {
        name: tokenName,
        website: tokenWebsite,
        description: tokenDescription,
        explorer: `https://polygonscan.com/token/${tokenAddress}`,
        type: "ERC20",
        symbol: tokenSymbol,
        decimals: parseInt(tokenDecimals),
        status: "active",
        id: tokenAddress
    };

    const infoPath = path.join(dirPath, 'info.json');
    console.log(`Criando arquivo info.json em ${infoPath}`);
    fs.writeFileSync(
        infoPath,
        JSON.stringify(info, null, 4)
    );

    console.log("\n✅ Metadados preparados com sucesso!");
    console.log(`\nArquivos gerados em: ${dirPath}`);
    console.log("\n=== PRÓXIMOS PASSOS ===");
    console.log("1. Envie os metadados para o Polygonscan:");
    console.log(`   → Acesse https://polygonscan.com/token/${tokenAddress}`);
    console.log("2. Clique em 'Update Token Info' e envie o logo e informações");
    console.log("3. A aprovação na Polygon é geralmente mais rápida que em outras redes");
    console.log("\nDicas para aprovação mais rápida:");
    console.log("- Certifique-se de que seu token tem liquidez no QuickSwap");
    console.log("- Forneça informações completas e precisas");
    console.log("- Na Polygon, o processo é menos rigoroso e mais ágil que em outras redes");

    rl.close();
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Erro durante a execução:");
        console.error(error);
        process.exit(1);
    });