const bcrypt = require("bcryptjs")

async function hashPasswords() {
  const passwords = [
    { email: "itmcoadmin@gmail.com", password: "itmcoadmin@12" },
    { email: "inventory@itmco.com", password: "inventory@itmco" },
    { email: "engineer@itmco.com", password: "engineer@itmco" },
  ]

  for (const user of passwords) {
    const hash = await bcrypt.hash(user.password, 10)
    console.log(`${user.email}: ${hash}`)
  }
}

hashPasswords()
