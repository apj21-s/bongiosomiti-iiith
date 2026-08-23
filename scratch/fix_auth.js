const fs = require('fs')
const path = require('path')

const files = [
  "app/api/admin/checkins/route.ts",
  "app/api/admin/checkins/[id]/undo/route.ts",
  "app/api/admin/payments/route.ts",
  "app/api/admin/events/route.ts",
  "app/api/admin/stats/route.ts",
  "app/api/admin/payments/[token]/reject/route.ts",
  "app/api/admin/registrations/route.ts",
  "app/api/admin/payments/[token]/approve/route.ts",
  "app/api/admin/registrations/[token]/route.ts",
  "app/api/admin/events/[slug]/route.ts"
]

const toReplace = `  const authSupabase = await createClient()
  const { data: { user } } = await authSupabase.auth.getUser()`
const replacement = `  const { data: authData } = await getCurrentUser()
  const user = authData?.user`

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8')
  
  if (!content.includes('getCurrentUser')) {
    content = `import { getCurrentUser } from '@/utils/auth/server'\n` + content
  }
  
  content = content.split(toReplace).join(replacement)
  
  fs.writeFileSync(file, content)
}
