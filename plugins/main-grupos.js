import fetch from 'node-fetch'

let handler  = async (m, { conn, usedPrefix, command }) => {
let img = await (await fetch(`https://i.postimg.cc/RVLzfsPF/Screenshot-20241107-034207.png`)).buffer()
const more = String.fromCharCode(8206)
const readMore = more.repeat(4001)
let txt = `*𝐆𝐫𝐮𝐩𝐨 𝐎𝐟𝐢𝐜𝐢𝐚𝐥 𝐝𝐞 𝐥𝐚 𝐛𝐨𝐭 l*

> Grupo De ruby

*🚩* ${group}

.。..。.。o○*:.。..。.。o○*:.。..。.。*:.。..。

> 📫 Enlace anulado? entre aquí! 

Canal :
*🏷️* ${canal}

> 🚩 ${textbot}`
await conn.sendFile(m.chat, img, "Thumbnail.jpg", txt, m, null, rcanal)
}
handler.help = ['grupos']
handler.tags = ['main']
handler.command = /^(grupos)$/i
export default handler
