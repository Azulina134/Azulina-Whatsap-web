let handler = async (m, { conn, isAdmin, isROwner }) => {
    if (!(isAdmin || isROwner)) return dfail('admin', m, conn)
    global.db.data.chats[m.chat].isBanned = true
    m.reply('𝐒𝐮𝐛-𝐁𝐨𝐭 𝐃𝐞𝐬𝐚𝐜𝐭𝐢𝐯𝐚𝐝𝐨🚩.')
}
handler.help = ['Bot Off']
handler.tags = ['Serbot']
handler.command = ['botoff', 'botoff']
handler.group = true 
export default handler
