import Dexie, { type Table } from 'dexie'

export interface Item {
  id?: number
  name: string
}

export class MyAppDB extends Dexie {
  items!: Table<Item>

  constructor() {
    super('MyAppDB')
    this.version(1).stores({
      items: '++id,name',
    })
  }
}

export const db = new MyAppDB()
