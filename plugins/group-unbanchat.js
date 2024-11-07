let handler = async (m, { conn, isAdmin, isROwner} ) => {
    if (!(isAdmin || isROwner)) return dfail('admin', m, conn)
    global.db.data.chats[m.chat].isBanned = false
    m.reply('𝐒𝐮𝐛-𝐁𝐨𝐭 𝐀𝐜𝐭𝐢𝐯𝐚𝐝𝐨🚩.')   
}
handler.help = ['Bot off']
handler.tags = ['serbot']
handler.command = ['Bot on', 'Bot on']
handler.group = true 
export default handler
