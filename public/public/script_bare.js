const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const socket = io(); // Initialize Socket.IO client

let width, height;
let publicKey = null;
let wallet = null;

let groups = {
  AllMemes: {name: 'All Tokens', tokens: []},
  OfficialMemes: {name: 'Official', tokens: []}
};


let currentGroup = groups.AllMemes
displayText = currentGroup.name

// Set up canvas size
function resizeCanvas() {
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = width;
  canvas.height = height;
  
  // Reset canvas context properties after resize
  ctx.fillStyle = '#001f00';
  ctx.font = '48px "Courier New", Courier, monospace';
  ctx.textAlign = 'center';
  
  // Trigger an immediate redraw after resize
  draw();
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);
     
// Create connect button in top right
function createConnectButton() {
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        display: flex;
        gap: 10px;
        z-index: 998;
    `;
    
    const connectBtn = document.createElement('button');
    connectBtn.textContent = 'Connect';
    connectBtn.style.cssText = `
        padding: 10px 20px;
        background: #4e44ce;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-family: system-ui, -apple-system, sans-serif;
        transition: background 0.2s;
    `;
    
    const groupBtn = document.createElement('button');
    groupBtn.textContent = 'Join Group';
    groupBtn.className = 'group-button';
    groupBtn.style.cssText = connectBtn.style.cssText + 'background: #2e8b57;';
    
    // Initially disable group button
    if (!publicKey) {
        groupBtn.style.opacity = '0.5';
        groupBtn.style.cursor = 'not-allowed';
    }
    
    const handleClick = () => createWalletOverlay();
    connectBtn.addEventListener('click', handleClick);

    buttonContainer.appendChild(connectBtn);
    document.body.appendChild(buttonContainer);
}

// Update window load event listener
window.addEventListener('load', () => {
    createConnectButton();
});

// Create wallet connection overlay
function createWalletOverlay() {
    // Create background overlay
    const backgroundOverlay = document.createElement('div');
    backgroundOverlay.id = 'wallet-background-overlay';
    backgroundOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 999;
    `;

    const overlay = document.createElement('div');
    overlay.id = 'wallet-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #9cc1cb;
        border: 2px solid #612d70;
        border-radius: 8px;
        padding: 20px;
        text-align: center;
        z-index: 1000;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    `;

    const title = document.createElement('h2');
    title.textContent = 'Connect Wallet';
    title.style.color = '#1a1a1a';
    overlay.appendChild(title);

    const baseButtonStyle = `
        display: block;
        width: 200px;
        margin: 10px auto;
        padding: 10px;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-family: system-ui, -apple-system, sans-serif;
        transition: background 0.2s;
    `;

    // Phantom connection button
    const phantomBtn = document.createElement('button');
    phantomBtn.textContent = 'Connect Phantom';
    phantomBtn.style.cssText = baseButtonStyle + 'background: #4e44ce;';
    phantomBtn.onclick = async () => await connectWallet('phantom');
    overlay.appendChild(phantomBtn);

    // Solflare connection button
    const solflareBtn = document.createElement('button');
    solflareBtn.textContent = 'Connect Solflare';
    solflareBtn.style.cssText = baseButtonStyle + 'background: #ac5d28;';
    solflareBtn.onclick = async () => await connectWallet('solflare');
    overlay.appendChild(solflareBtn);
    
    // Add click handler for background overlay
    const closeOverlay = () => {
        const bgOverlay = document.getElementById('wallet-background-overlay');
        const walletOverlay = document.getElementById('wallet-overlay');
        if (bgOverlay) bgOverlay.remove();
        if (walletOverlay) walletOverlay.remove();
    };
    
    backgroundOverlay.addEventListener('click', closeOverlay);

    // Prevent clicks on the modal from closing it
    overlay.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    document.body.appendChild(backgroundOverlay);
    document.body.appendChild(overlay);
}

// Add minBalance constant
const minBalance = 10000; // Default minimum balance requirement

// Add function to check token balance
async function checkTokenBalance() {
    try {
        // Verify we're in a secure context with a valid wallet connection
        if (!wallet || !publicKey) {
            console.error('Invalid wallet state');
            return 0;
        }

        const connection = new solanaWeb3.Connection('https://mainnet.helius-rpc.com/?api-key=9de0b45d-2c02-471d-91a0-808da4274b97');
        const tokenMint = new solanaWeb3.PublicKey('HUVPbbr9QaDCJ9BQGcP94nzckm4nVYeDpwhWLcb5pump');
        const userPublicKey = new solanaWeb3.PublicKey(publicKey);

        // Get token account
        const tokenAccounts = await connection.getTokenAccountsByOwner(userPublicKey, {
            mint: tokenMint
        });

        if (tokenAccounts.value.length === 0) {
            console.log('No token account found - Balance is 0');
            return 0;
        }

        // Get balance
        const tokenAccount = tokenAccounts.value[0];
        const accountInfo = await connection.getParsedAccountInfo(tokenAccount.pubkey);
        const balance = accountInfo.value.data.parsed.info.tokenAmount.uiAmount;
        
        console.log('Token Balance:', balance);

        // Check if balance meets minimum requirement
        if (balance >= minBalance) {
            // Sign a message to verify wallet ownership
            const message = new TextEncoder().encode(`Login verification for ${publicKey}`);
            try {
                const signedMessage = await wallet.signMessage(message, 'utf8');
                if (signedMessage) {
                    // If signature is valid, proceed with login
                    await userLogin(publicKey);
                }
            } catch (signError) {
                console.error('Message signing failed:', signError);
            }
        }

        return balance;
    } catch (error) {
        console.error('Error checking token balance:', error);
        return 0;
    }
}

// Update connectWallet function
async function connectWallet(walletName) {
    try {
        let walletAdapter;
        if (walletName === 'phantom') {
            walletAdapter = window.solana;
            if (!walletAdapter?.isPhantom) {
                alert('Please install Phantom wallet');
                return;
            }
        } else if (walletName === 'solflare') {
            walletAdapter = window.solflare;
            if (!walletAdapter) {
                alert('Please install Solflare wallet');
                return;
            }
        }

        await walletAdapter.connect();
        wallet = walletAdapter;
        publicKey = wallet.publicKey.toString();
        
        // Close overlay first
        const bgOverlay = document.getElementById('wallet-background-overlay');
        const walletOverlay = document.getElementById('wallet-overlay');
        if (bgOverlay) bgOverlay.remove();
        if (walletOverlay) walletOverlay.remove();
        
        // Update connect button
        const connectBtn = document.querySelector('button[style*="background: #4e44ce"]');
        if (connectBtn) {
            connectBtn.textContent = publicKey.substring(0, 5);
            connectBtn.removeEventListener('click', () => createWalletOverlay());
            connectBtn.onclick = null;
        }
        
        // Enable group button
        const groupBtn = document.querySelector('.group-button');
        if (groupBtn) {
            groupBtn.style.opacity = '1';
            groupBtn.style.cursor = 'pointer';
        }
        
        // Check balance after UI updates
        await checkTokenBalance();
        
        console.log('Connected wallet:', publicKey);
    } catch (err) {
        console.error('Wallet connection error:', err);
        alert('Failed to connect wallet');
    }
}

// Add userLogin function
async function userLogin(walletAddress) {
    // Get first 5 characters of wallet address
    const shortAddress = walletAddress.substring(0, 5);
    console.log('User logged in:', shortAddress);
}

// Update draw function to use displayText
function draw() {
    // Clear the canvas
    ctx.fillStyle = '#001f00'; // Dark gray/green background
    ctx.fillRect(0, 0, width, height);
    
    // Draw the text at the top center
    ctx.save();
    ctx.font = '48px "Courier New", Courier, monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#00ff00';
    ctx.fillText(displayText, width / 2, 60);
    ctx.restore();

    // Request the next frame
    requestAnimationFrame(draw);
}

// Start the animation loop
draw();

// Helper function to create overlay
function createOverlay() {
    const backgroundOverlay = document.createElement('div');
    backgroundOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 999;
    `;

    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #9cc1cb;
        border: 2px solid #612d70;
        border-radius: 8px;
        padding: 20px;
        text-align: center;
        z-index: 1000;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    `;
    
    const closeOverlay = () => {
        backgroundOverlay.remove();
        overlay.remove();
    };
    
    backgroundOverlay.addEventListener('click', closeOverlay);
    overlay.addEventListener('click', (e) => e.stopPropagation());
    
    document.body.appendChild(backgroundOverlay);
    document.body.appendChild(overlay);
    
    return { overlay, backgroundOverlay, closeOverlay };
}

