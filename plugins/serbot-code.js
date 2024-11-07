import {
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    jidNormalizedUser ,
    PHONENUMBER_MCC
} from '@whiskeysockets/baileys';

import NodeCache from 'node-cache';
import readline from 'readline';
import crypto from 'crypto';
import fs from "fs";
import pino from 'pino';
import { makeWASocket } from '../lib/simple.js';

if (!global.conns) {
    global.conns = [];
}

let handler = async (m, { conn: _conn, args, usedPrefix, command, isOwner }) => {
    if (!((args[0] && args[0] == 'plz') || (_conn.user.jid == _conn.user.jid))) {
        return m.reply(`Este comando solo puede ser usado en el bot principal! wa.me/${global.conn.user.jid.split`@`[0]}?text=${usedPrefix}code`)
    }

    async function serbot() {
        let authFolderB = crypto.randomBytes(10).toString('hex').slice(0, 8);

        if (!fs.existsSync("./serbot/" + authFolderB)) {
            fs.mkdirSync("./serbot/" + authFolderB, { recursive: true });
        }
        args[0] ? fs.writeFileSync("./serbot/" + authFolderB + "/creds.json", JSON.stringify(JSON.parse(Buffer.from(args[0], "base64").toString("utf-8")), null, '\t')) : "";

        const { state, saveCreds } = await useMultiFileAuthState(`./serbot/${authFolderB}`);
        const msgRetryCounterCache = new NodeCache();
        const { version } = await fetchLatestBaileysVersion();
        let phoneNumber = m.sender.split('@')[0];

        const methodCodeQR = process.argv.includes("qr");
        const methodCode = !!phoneNumber || process.argv.includes("code");
        const MethodMobile = process.argv.includes("mobile");

        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const question = (texto) => new Promise((resolver) => rl.question(texto, resolver));

        const connectionOptions = {
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            mobile: MethodMobile,
            browser: ["Ubuntu", "Chrome", "20.0.04"],
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
            },
            markOnlineOnConnect: true,
            generateHighQualityLinkPreview: true,
            getMessage: async (clave) => {
                let jid = jidNormalizedUser (clave.remoteJid);
                let msg = await store.loadMessage(jid, clave.id);
                return msg?.message || "";
            },
            msgRetryCounterCache,
            defaultQueryTimeoutMs: undefined,
            version
        };

        let conn = makeWASocket(connectionOptions);

        if (methodCode && !conn.authState.creds.registered) {
            if (!phoneNumber) {
                process.exit(0);
            }
            let cleanedNumber = phoneNumber.replace(/[^0-9]/g, '');
            if (!Object.keys(PHONENUMBER_MCC).some(v => cleanedNumber.startsWith(v))) {
                process.exit(0);
            }

            setTimeout(async () => {
                let codeBot = await conn.requestPairingCode(cleanedNumber);
                codeBot = codeBot?.match(/.{1,4}/g)?.join("-") || codeBot;

                await m.reply(`🚩᪥𝑺𝒐𝒍𝒊𝒄𝒊𝒕𝒖𝒅 𝒑𝒂𝒓𝒂 𝒔𝒆𝒓 𝒖𝒏 𝒔𝒖𝒃-𝒃𝒐𝒕᪥* 💥✨

𝑷𝒂𝒔𝒐𝒔  𝒑𝒂𝒓𝒂 𝒔𝒆𝒓 𝒖𝒏 𝒔𝒖𝒃: * 👇

1️⃣ ᪥ 𝑯𝒂𝒈𝒂 𝒄𝒍𝒊𝒄𝒌 𝒆𝒏 𝒍𝒐𝒔 3 𝒑𝒖𝒏𝒕𝒐𝒔 * 

2️⃣ ᪥𝑻𝒐𝒒𝒖𝒆 𝒅𝒊𝒔𝒑𝒐𝒔𝒊𝒕𝒊𝒗𝒐𝒔 𝒗𝒊𝒏𝒄𝒖𝒍𝒂𝒅𝒐𝒔* 

3️⃣ ᪥𝑺𝒆𝒍𝒆𝒄𝒄𝒊𝒐𝒏𝒂 𝒗𝒊𝒏𝒄𝒖𝒍𝒂𝒓 𝒄𝒐𝒏 𝒆𝒍 𝒏𝒖𝒎𝒆𝒓𝒐 𝒅𝒆 𝒕𝒆𝒍𝒆𝒇𝒐𝒏𝒐* 

4️⃣ ᪥𝑬𝒔𝒄𝒓𝒊𝒃𝒂 𝒆𝒍 𝑪𝒐𝒅𝒊𝒈𝒐* 

⟲𝑵𝒐𝒕𝒂: 𝑬𝒔𝒕𝒆 𝒄𝒐𝒅𝒊𝒈𝒐 𝒔𝒐𝒍𝒐 𝒇𝒖𝒏𝒄𝒊𝒐𝒏𝒂 𝒆𝒏 𝒆𝒍 𝒏𝒖𝒎𝒆𝒓𝒐 𝒒𝒖𝒆 𝒍𝒐 𝒔𝒐𝒍𝒊𝒄𝒊𝒕𝒐. ⚠️

\n\nPara enterate si el bot cambia de número, únete al canal💥: https://whatsapp.com/channel/0029VaXDEwlC1FuFm82otA0K*`);
                rl.close();
            }, 3000);
        }

        conn.isInit = false;
        let isInit = true;
        let reconnectionAttempts = 0;

        async function connectionUpdate(update) {
            const { connection, lastDisconnect, isNewLogin, qr } = update;
            if (isNewLogin) conn.isInit = true;
            const code = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.output?.payload?.statusCode;

            if (code && code !== DisconnectReason.loggedOut && conn?.ws.socket == null) {
                let i = global.conns.indexOf(conn);
                if (i < 0) return console.log(await creloadHandler(true).catch(console.error));
                delete global.conns[i];
                global.conns.splice(i, 1);

                if (code !== DisconnectReason.connectionClosed) {
                    _conn.sendMessage(m.chat, { text: "Conexión perdida.." }, { quoted: m });
                }
            }

            if (global.db.data == null) loadDatabase();

            if (connection == 'open') {
                conn.isInit = true;
                global.conns.push(conn);
                await _conn.sendMessage(m.chat, { text: args[0] ? `✅ conectado exitosamente` : `*\n\n Unete al canal con este enlace: https://whatsapp.com/channel/0029VaXDEwlC1FuFm82otA0K` }, { quoted: m });
                await sleep(5000);
                if (args[0]) return;
            }

            // Lógica de reconexión automática
            if (connection === 'close' || connection === 'error') {
                reconnectionAttempts++;
                let waitTime = Math.min(reconnectionAttempts, 4); // Aumenta el tiempo de espera hasta 4 segundos
                if
(reconnectionAttempts >= 4) {
                    waitTime = 10; // Si se han fallado 4 intentos, espera 10 segundos
                }

                setTimeout(async () => {
                    try {
                        // Cierra la conexión actual
                        conn.ws.close();

                        // Remueve los listeners existentes
                        conn.ev.off('messages.upsert', conn.handler);
                        conn.ev.off('connection.update', conn.connectionUpdate);
                        conn.ev.off('creds.update', conn.credsUpdate);

                        // Crea una nueva conexión
                        conn = makeWASocket(connectionOptions);

                        // Reasigna los listeners y handlers
                        conn.handler = handler.handler.bind(conn);
                        conn.connectionUpdate = connectionUpdate.bind(conn);
                        conn.credsUpdate = saveCreds.bind(conn, true);

                        // Vuelve a agregar los listeners
                        conn.ev.on('messages.upsert', conn.handler);
                        conn.ev.on('connection.update', conn.connectionUpdate);
                        conn.ev.on('creds.update', conn.credsUpdate);

                        // Reinicia la lógica de manejo de conexión
                        await creloadHandler(false);
                    } catch (error) {
                        console.error('Error durante la reconexión:', error);
                    }
                }, waitTime * 1000); // Espera el tiempo definido antes de intentar reconectar
            }
        }

        // Limpia la conexión y los listeners cada 60 segundos si el usuario no está conectado
        setInterval(async () => {
            if (!conn.user) {
                try {
                    conn.ws.close();
                } catch {
                    // Manejo de errores al cerrar la conexión
                }
                conn.ev.removeAllListeners();
                let i = global.conns.indexOf(conn);
                if (i < 0) return;
                delete global.conns[i];
                global.conns.splice(i, 1);
            }
        }, 60000);

        // Importa el handler y define la función creloadHandler
        let handler = await import('../handler.js');
        let creloadHandler = async function (restartConn) {
            try {
                // Importa el handler actualizado
                const Handler = await import(`../handler.js?update=${Date.now()}`).catch(console.error);
                if (Object.keys(Handler || {}).length) handler = Handler;
            } catch (e) {
                console.error(e);
            }

            // Si se requiere reiniciar la conexión, cierra la conexión actual y vuelve a crearla
            if (restartConn) {
                try {
                    conn.ws.close();
                } catch {
                    // Manejo de errores al cerrar la conexión
                }
                conn.ev.removeAllListeners();
                conn = makeWASocket(connectionOptions);
                isInit = true;
            }

            // Si no está inicializado, remueve los listeners antiguos y asigna los nuevos
            if (!isInit) {
                conn.ev.off('messages.upsert', conn.handler);
                conn.ev.off('connection.update', conn.connectionUpdate);
                conn.ev.off('creds.update', conn.credsUpdate);
            }

            // Asigna los handlers y listeners actualizados
            conn.handler = handler.handler.bind(conn);
            conn.connectionUpdate = connectionUpdate.bind(conn);
            conn.credsUpdate = saveCreds.bind(conn, true);

            // Vuelve a agregar los listeners
            conn.ev.on('messages.upsert', conn.handler);
            conn.ev.on('connection.update', conn.connectionUpdate);
            conn.ev.on('creds.update', conn.credsUpdate);

            isInit = false;
            return true;
        };

        // Inicia la función creloadHandler
        await creloadHandler(false);
    }

    // Llama a la función serbot
    serbot();
};

// Define las propiedades de ayuda, etiquetas, comandos y propiedades de exportación
handler.help = ['code'];
handler.tags = ['serbot'];
handler.command = ['code', 'codebot', 'botclone', 'serbot'];
handler.rowner = false;

// Exporta el handler
export default handler;

// Función para pausar la ejecución durante un tiempo dado
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
