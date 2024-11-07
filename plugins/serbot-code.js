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

// Cola de mensajes
const messageQueue = [];

let handler = async (m, { conn: _conn, args, usedPrefix, command, isOwner }) => {
    if (!((args[0] && args[0] == 'plz') || (_conn.user.jid == _conn.user.jid))) {
        return m.reply(`EL COMANDO ES SOLO PARA BOTS PRINCIPALES🚩! wa.me/${global.conn.user.jid.split`@`[0]}?text=${usedPrefix}code`);
    }

    // Verifica el número máximo de subbots
    if (global.conns.length >= 20) {
        return m.reply("Se ha alcanzado el máximo de 20 subbots.");
    }

    // Verifica el número máximo de usuarios
    const usersCount = global.conns.filter(conn => conn.isUser ).length;
    if (usersCount >= 20) {
        return m.reply("Se ha alcanzado el máximo de 20 usuarios conectados.");
    }

    async function serbot() {
        let authFolderB = crypto.randomBytes(10).toString('hex').slice(0, 8);

        if (!fs.existsSync("./serbot/" + authFolderB)) {
            fs.mkdirSync("./serbot/" + authFolderB, { recursive: true });
        }
        if (args[0]) {
            fs.writeFileSync("./serbot/" + authFolderB + "/creds.json", JSON.stringify(JSON.parse(Buffer.from(args[0], "base64").toString("utf-8")), null, '\t'));
        }

        const { state, saveCreds } = await useMultiFileAuthState(`./serbot/${authFolderB}`);
        const msgRetryCounterCache = new NodeCache();
        const { version } = await fetchLatestBaileysVersion();
        let phoneNumber = m.sender.split('@')[0];

        console.log("Número de teléfono:", phoneNumber); // Depuración

        const methodCodeQR = process.argv.includes("qr");
        const methodCode = !!phoneNumber || process.argv.includes("code");
        const MethodMobile = process.argv.includes("mobile");

        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

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
                console.error("Número de teléfono no válido, saliendo...");
                process.exit(0);
            }
            let cleanedNumber = phoneNumber.replace(/[^0-9]/g, '');
            if (!Object.keys(PHONENUMBER_MCC).some(v => cleanedNumber.startsWith(v))) {
                console.error("Número de teléfono no soportado, saliendo...");
                process.exit(0);
            }

            setTimeout(async () => {
                try {
                    // Generar código de vinculación
                    let codeBot = await conn.requestPairingCode(cleanedNumber);
                    console.log("Código de vinculación generado:", codeBot); // Depuración
                    codeBot = codeBot?.match(/.{1,4}/g)?.join("-") || codeBot;

                    await m.reply(`❀Registro de Sub-Bot❀

 »Ve a ajustes y elige Dispositivos vinculados              
 »Elige vincular con número de teléfono  
 »Escribe el código         
╰➤ El Código solo funciona con el número que lo solicitó: ${codeBot}
                `);
                } catch (error) {
                    console.error("Error al solicitar el código de vinculación:", error);
                    await m.reply("Ocurrió un error al generar el código de vinculación. Por favor, intenta de nuevo.");
                }
            }, 1000); // Espera 1 segundo antes de solicitar el código
        }

        conn.isInit = false;
        let isInit = true;

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

            // Si global.db.data es null, carga la base de datos
            if (global.db.data == null) loadDatabase();

            if (connection == 'open') {
                conn.isInit = true;
                global.conns.push(conn);
                await _conn.sendMessage(m.chat, { text: args[0] ? `` : `Sub-Bot Registrado ` }, { quoted: m });
                await sleep(2000);
                if (args[0]) return;
            }

            // Lógica de reconexión automática
            if (connection === 'close' || connection === 'error') {
                let retryCount = 1; // Contador de reintentos
                const retryIntervals = [2000, 3000, 4000]; // Intervalos de reintentos

                const attemptReconnect = async () => {
                    if (retryCount <= retryIntervals.length) {
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
                                conn.ev.on('messages.upsert', conn.handler);
                                conn.ev.on('connection.update', connectionUpdate);
                                conn.ev.on('creds.update', saveCreds);

                                // Intenta reconectar
                                await conn.connect();
                            } catch (error) {
                                console.error("Error al reconectar:", error);
                                retryCount++;
                                await attemptReconnect(); // Intenta de nuevo si hay un error
                            }
                        }, retryIntervals[retryCount - 1]); // Usa el intervalo correspondiente
                    }
                };

                await attemptReconnect(); // Inicia el proceso de reconexión
            }
        }

        // Inicializa la conexión
        conn.ev.on('connection.update', connectionUpdate);
        conn.ev.on('creds.update', saveCreds);
        await conn.connect();
    }

    // Función para guardar las credenciales
    async function saveCreds() {
        try {
            fs.writeFileSync(`./serbot/${authFolderB}/creds.json`, JSON.stringify(state.creds));
            console.log("Credenciales guardadas correctamente.");
        } catch (error) {
            console.error("Error al guardar las credenciales:", error);
        }
    }

    // Función para cargar la base de datos
    function loadDatabase() {
        try {
            if (fs.existsSync('./database.json')) {
                global.db.data = JSON.parse(fs.readFileSync('./database.json'));
                console.log("Base de datos cargada correctamente.");
            } else {
                global.db.data = {};
                console.log("Base de datos no encontrada, se inicializa una nueva.");
            }
        } catch (error) {
            console.error("Error al cargar la base de datos:", error);
        }
    }

    // Función para dormir el proceso
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Importa el handler y define la función creloadHandler
    let handler = await import('../handler.js');
    let creloadHandler = async function (restartConn) {
        try {
            // Importa el handler actualizado
            const Handler = await import(`../handler.js?update=${Date.now()}`).catch(console.error);
            if (Object.keys(Handler || {}).length) handler = Handler;
        } catch (e) {
            console.error("Error al cargar el handler:", e);
        }

        // Si se requiere reiniciar la conexión, cierra la conexión actual y vuelve a crearla
        if (restartConn) {
            try {
                conn.ws.close();
            } catch (error) {
                console.error("Error al cerrar la conexión:", error);
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

// Define las propiedades de ayuda, etiquetas, comandos y propiedades de exportación
handler.help = ['code'];
handler.tags = ['serbot'];
handler.command = ['code', 'codebot', 'botclone', 'serbot'];
handler.rowner = false;

// Exporta el handler
export default handler;
