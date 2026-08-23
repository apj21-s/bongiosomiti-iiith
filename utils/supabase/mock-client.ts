import { readDB, writeDB, generateToken, atomicCheckin } from '@/utils/db/dummy-store'
import { v4 as uuidv4 } from 'uuid'

export function createMockClient() {
  return {
    auth: {
      // Stub auth for middleware and unified layer to pass through if they call it directly (though unified layer shouldn't)
      async getUser() {
        return { data: { user: null }, error: null }
      },
      async signInWithPassword() {
        return { data: {}, error: { message: "Mock client doesn't support Supabase Auth" } }
      },
      async signOut() {
        return { error: null }
      }
    },
    from(tableName: string) {
      let state = {
        table: tableName as 'events' | 'tickets' | 'checkins' | 'admin_profiles',
        operation: 'select', // select, insert, update, delete
        selectFields: '*',
        filters: [] as any[],
        orderOpts: [] as any[],
        limitVal: null as number | null,
        isSingle: false,
        isMaybeSingle: false,
        insertData: null as any,
        updateData: null as any,
        isCount: false,
        countType: null as string | null
      }

      function execute() {
        const db = readDB()
        let collection = [...(db[state.table] || [])]

        if (state.operation === 'insert') {
          let rowsToInsert = Array.isArray(state.insertData) ? state.insertData : [state.insertData]
          rowsToInsert = rowsToInsert.map(r => {
            const newRow = { ...r }
            if (!newRow.id) newRow.id = uuidv4()
            if (!newRow.created_at) newRow.created_at = new Date().toISOString()
            return newRow
          })
          db[state.table] = [...collection, ...rowsToInsert]
          writeDB(db)
          return { data: Array.isArray(state.insertData) ? rowsToInsert : rowsToInsert[0], error: null }
        }

        if (state.operation === 'delete') {
          const originalLength = collection.length
          collection = collection.filter(row => !matchesFilters(row, state.filters))
          db[state.table] = collection
          writeDB(db)
          return { data: null, error: null } // Supabase delete doesn't return data by default unless returning()
        }

        if (state.operation === 'update') {
          let updatedRows: any[] = []
          collection = collection.map(row => {
            if (matchesFilters(row, state.filters)) {
              const newRow = { ...row, ...state.updateData }
              updatedRows.push(newRow)
              return newRow
            }
            return row
          })
          db[state.table] = collection
          writeDB(db)
          return { data: updatedRows, error: null }
        }

        // SELECT operation
        collection = collection.filter(row => matchesFilters(row, state.filters))

        // Populate joins natively since the API uses `event:events(slug, name)`
        // Very basic mock of relation expanding for this specific project.
        if (state.selectFields.includes('event:events') || state.selectFields.includes('event:events(')) {
          collection = collection.map(row => {
            if (row.event_id) {
              row.event = db.events.find(e => e.id === row.event_id)
            }
            return row
          })
        }

        if (state.selectFields.includes('ticket:tickets')) {
          collection = collection.map(row => {
            if (row.ticket_id) {
              const ticket = db.tickets.find(t => t.id === row.ticket_id)
              if (ticket) {
                // Populate nested event
                ticket.event = db.events.find(e => e.id === ticket.event_id)
              }
              row.ticket = ticket
            }
            return row
          })
        }

        if (state.orderOpts.length > 0) {
          collection.sort((a, b) => {
            for (let opt of state.orderOpts) {
              const valA = a[opt.column]
              const valB = b[opt.column]
              if (valA === valB) continue
              if (opt.ascending) return valA > valB ? 1 : -1
              return valA < valB ? 1 : -1
            }
            return 0
          })
        }

        if (state.limitVal !== null) {
          collection = collection.slice(0, state.limitVal)
        }

        let count = collection.length

        if (state.isSingle) {
          if (collection.length === 0) return { data: null, error: { message: 'Row not found' }, count }
          if (collection.length > 1) return { data: null, error: { message: 'Multiple rows returned' }, count }
          return { data: collection[0], error: null, count }
        }

        if (state.isMaybeSingle) {
          if (collection.length === 0) return { data: null, error: null, count }
          if (collection.length > 1) return { data: null, error: { message: 'Multiple rows returned' }, count }
          return { data: collection[0], error: null, count }
        }

        if (state.isCount && !state.selectFields) {
          return { data: null, error: null, count }
        }

        return { data: collection, error: null, count }
      }

      function matchesFilters(row: any, filters: any[]) {
        for (let f of filters) {
          if (f.op === 'eq' && row[f.col] !== f.val) return false
          if (f.op === 'neq' && row[f.col] === f.val) return false
          if (f.op === 'in' && !f.val.includes(row[f.col])) return false
          if (f.op === 'ilike') {
            const regex = new RegExp(f.val.replace(/%/g, '.*'), 'i')
            if (!regex.test(row[f.col] || '')) return false
          }
          if (f.op === 'or') {
            // Very simple OR for search: "participant_name.ilike.%q%,college_id.ilike.%q%,email.ilike.%q%,phone.ilike.%q%,token.ilike.%q%"
            const conditions = f.val.split(',')
            let orMatch = false
            for (let cond of conditions) {
              const [col, op, ...valParts] = cond.split('.')
              const val = valParts.join('.').replace(/%/g, '.*')
              if (op === 'ilike' && new RegExp(val, 'i').test(row[col] || '')) {
                orMatch = true
                break
              }
              if (op === 'eq' && row[col] === valParts.join('.')) {
                orMatch = true
                break
              }
            }
            if (!orMatch) return false
          }
        }
        return true
      }

      const builder: any = {
        select(fields: string = '*', opts?: { count?: string, head?: boolean }) {
          if (state.operation !== 'insert' && state.operation !== 'update') {
            state.operation = 'select'
          }
          state.selectFields = fields
          if (opts?.count) {
            state.isCount = true
            state.countType = opts.count
          }
          return builder
        },
        insert(data: any) {
          state.operation = 'insert'
          state.insertData = data
          return builder
        },
        update(data: any) {
          state.operation = 'update'
          state.updateData = data
          return builder
        },
        delete() {
          state.operation = 'delete'
          return builder
        },
        eq(col: string, val: any) {
          state.filters.push({ op: 'eq', col, val })
          return builder
        },
        neq(col: string, val: any) {
          state.filters.push({ op: 'neq', col, val })
          return builder
        },
        in(col: string, val: any[]) {
          state.filters.push({ op: 'in', col, val })
          return builder
        },
        ilike(col: string, val: string) {
          state.filters.push({ op: 'ilike', col, val })
          return builder
        },
        or(query: string) {
          state.filters.push({ op: 'or', val: query })
          return builder
        },
        order(column: string, opts: { ascending?: boolean } = { ascending: true }) {
          state.orderOpts.push({ column, ascending: opts.ascending ?? true })
          return builder
        },
        limit(val: number) {
          state.limitVal = val
          return builder
        },
        single() {
          state.isSingle = true
          return builder
        },
        maybeSingle() {
          state.isMaybeSingle = true
          return builder
        },
        then(resolve: any, reject: any) {
          try {
            resolve(execute())
          } catch (e) {
            reject(e)
          }
        }
      }

      // Allow awaiting the builder
      return builder
    },
    // Special export for atomic operation bypassing standard builder to simulate the race safe SQL update
    rpc(fnName: string, args: any) {
      if (fnName === 'atomic_checkin') {
        const { token, gate, adminId } = args
        const res = atomicCheckin(token, gate, adminId)
        return { data: res, error: null }
      }
      return { data: null, error: { message: 'RPC not implemented on mock client' } }
    }
  }
}
