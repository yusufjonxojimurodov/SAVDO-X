function formatPhone(phone) {
  if (!phone) return "";
  let clean = phone.replace(/\D/g, "");
  if (clean.startsWith("998")) {
    clean = "+" + clean;
  } else if (!clean.startsWith("+998")) {
    clean = "+998" + clean;
  }
  return clean;
}

function formatName(name = "") {
  if (!name) return "";
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

function formatDate(date) {
  if (!date) return "";
  const d = new Date(date);
  return d.toLocaleDateString("uz-UZ");
}

function formatTime(date) {
  if (!date) return "";
  const d = new Date(date);
  return d.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" });
}

function formatUserInfo(user) {
  return `👤 *Foydalanuvchi*: ${formatName(user.name || "-")} ${formatName(
    user.surname || "-"
  )}
📞 *Telefon*: ${formatPhone(user.phone)}
💬 *Username*: @${user.userName || "-"}
🔑 *Rol*: ${user.role || "customer"}`;
}

function asAt(username) {
  if (!username) return "—";
  const clean = username.startsWith("@") ? username : `@${username}`;
  return clean;
}

function genRequestId() {
  const random = Math.random().toString(36).substring(2, 8); 
  const timestamp = Date.now().toString(36); 
  return `${timestamp}_${random}`;
}

module.exports = {
  formatPhone,
  formatName,
  formatDate,
  formatTime,
  formatUserInfo,
  asAt,
  genRequestId,
};
