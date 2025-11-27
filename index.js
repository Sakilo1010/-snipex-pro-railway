const { Telegraf } = require('telegraf');
const { Connection, Keypair, LAMPORTS_PER_SOL, VersionedTransaction } = require('@solana/web3.js');
const axios = require('axios');


const BOT_TOKEN = '8560926260:AAH5n57UFoN4dUu3QTGy-Pi9uQDqJEuX6WU
const PRIVATE_KEY = '5L13J5cwpPVU4MCMBMs4JSuMxk3RhhzBN27M1wv3z4didTFYMMaBzwGzq7JiPEuLgVmQAhTMaeY3yLduSkv4dxPC';

const connection = new Connection('https://api.mainnet-beta.solana.com');

// Wallet Setup
let wallet;
try {
    const secretKey = JSON.parse(PRIVATE_KEY);
    wallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));
    console.log(`✅ Wallet: ${wallet.publicKey.toString()}`);
} catch (e) {
    console.log('❌ ERROR: Fix PRIVATE_KEY!');
    process.exit(1);
}

// Balance Function
async function getBalance() {
    try {
        const balance = await connection.getBalance(wallet.publicKey);
        return (balance / LAMPORTS_PER_SOL).toFixed(4);
    } catch {
        return '0.0000';
    }
}

// Trading Function
async function executeSwap(tokenAddress, amountSol, isBuy = true) {
    try {
        const amount = Math.floor(amountSol * LAMPORTS_PER_SOL);
        const inputMint = isBuy ? 'So11111111111111111111111111111111111111112' : tokenAddress;
        const outputMint = isBuy ? tokenAddress : 'So11111111111111111111111111111111111111112';
        
        const quoteResponse = await axios.get(
            `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=5000`
        );
        
        const swapResponse = await axios.post('https://quote-api.jup.ag/v6/swap', {
            quoteResponse: quoteResponse.data,
            userPublicKey: wallet.publicKey.toString(),
            wrapAndUnwrapSol: true,
            computeUnitPriceMicroLamports: 2000000
        });
        
        const swapTransactionBuf = Buffer.from(swapResponse.data.swapTransaction, 'base64');
        const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
        transaction.sign([wallet]);
        
        const signature = await connection.sendTransaction(transaction);
        await connection.confirmTransaction(signature);
        return signature;
    } catch (error) {
        throw new Error(error.response?.data?.error || error.message);
    }
}

// Telegram Bot
const bot = new Telegraf(BOT_TOKEN);

bot.start(async (ctx) => {
    const balance = await getBalance();
    await ctx.reply(`
🤖 *SNIPEX PRO v3.0* 🚂 RAILWAY

💰 *Balance:* \`${balance} SOL\`
👤 *User:* ${ctx.from.username || 'Anonymous'}

🔥 *COMMANDS:*
• \`/balance\` - Check wallet
• \`/buy <token> <amount>\` - Buy
• \`/snipe <token> <amount>\` - FAST
• \`/help\` - Help

⚡ *Railway 24/7 hosting!*`, { parse_mode: 'Markdown' });
});

bot.command('balance', async (ctx) => {
    const balance = await getBalance();
    await ctx.reply(`💰 *WALLET*\n\n💎 \`${balance} SOL\`\n🚂 Railway Active`, { parse_mode: 'Markdown' });
});

bot.command('buy', async (ctx) => {
    const args = ctx.message.text.split(' ').slice(1);
    if (args.length < 2) return ctx.reply('❌ `/buy <token> <amount>`\n*Ex:* `/buy EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v 0.1`', { parse_mode: 'Markdown' });

    const [token, amount] = args;
    const msg = await ctx.reply(`🔄 Buying ${amount} SOL of ${token.slice(0, 8)}...`);

    try {
        const tx = await executeSwap(token, parseFloat(amount), true);
        await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, 
            `✅ *BUY SUCCESS!*\n💰 \`${amount} SOL\`\n🎯 \`${token.slice(0, 8)}...\`\n📝 \`${tx}\``,
            { parse_mode: 'Markdown' }
        );
    } catch (error) {
        await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, `❌ *FAILED!*\n${error.message}`, { parse_mode: 'Markdown' });
    }
});

bot.command('snipe', async (ctx) => {
    const args = ctx.message.text.split(' ').slice(1);
    if (args.length < 2) return ctx.reply('❌ `/snipe <token> <amount>`');

    const [token, amount] = args;
    const msg = await ctx.reply(`🚀 *SNIPING* ${token.slice(0, 8)}...\n⚡ Fast execution...`);

    try {
        const tx = await executeSwap(token, parseFloat(amount), true);
        await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, 
            `🎯 *SNIPE SUCCESS!*\n💰 \`${amount} SOL\`\n📝 \`${tx}\`\n⚡ <100ms`,
            { parse_mode: 'Markdown' }
        );
    } catch (error) {
        await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, `💥 *SNIPE FAILED!*\n${error.message}`, { parse_mode: 'Markdown' });
    }
});

// Start Bot
console.log('🚀 Starting Snipex Pro...');
bot.launch().then(() => {
    console.log('✅ SNIPEX PRO RAILWAY LIVE!');
});

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));