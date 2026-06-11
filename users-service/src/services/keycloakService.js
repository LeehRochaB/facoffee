const axios = require('axios')


async function getAdminToken() {
  const res = await axios.post(
    `${process.env.KEYCLOAK_URL}/realms/master/protocol/openid-connect/token`,
    new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.KEYCLOAK_CLIENT_ID,
      client_secret: process.env.KEYCLOAK_CLIENT_SECRET
    })
  )
  return res.data.access_token
}


exports.createUser = async ({ id, name, email, roles }) => {
  const token = await getAdminToken()
  await axios.post(
    `${process.env.KEYCLOAK_URL}/admin/realms/${process.env.KEYCLOAK_REALM}/users`,
    { username: email, email, firstName: name, enabled: true, attributes: { domainId: [id] } },
    { headers: { Authorization: `Bearer ${token}` } }
  )
}


exports.updateUserRoles = async (userId, roles) => {
  console.log(`Atualizando roles do usuario ${userId}:`, roles)
}
