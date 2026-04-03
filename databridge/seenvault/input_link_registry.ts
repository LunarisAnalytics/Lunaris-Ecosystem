export interface InputLink {
  id: string
  source: string
  url: string
  metadata?: Record<string, any>
  createdAt?: number
  updatedAt?: number
}

export interface InputLinkResult {
  success: boolean
  link?: InputLink
  error?: string
}

export interface ListOptions {
  source?: string
  sortBy?: 'id' | 'source' | 'createdAt'
  direction?: 'asc' | 'desc'
}

export class InputLinkHandler {
  private links = new Map<string, InputLink>()

  register(link: InputLink): InputLinkResult {
    if (this.links.has(link.id)) {
      return { success: false, error: `Link with id "${link.id}" already exists.` }
    }
    const entry = { ...link, createdAt: Date.now(), updatedAt: Date.now() }
    this.links.set(link.id, entry)
    return { success: true, link: entry }
  }

  upsert(link: InputLink): InputLinkResult {
    const existing = this.links.get(link.id)
    const entry = {
      ...link,
      createdAt: existing?.createdAt ?? Date.now(),
      updatedAt: Date.now()
    }
    this.links.set(link.id, entry)
    return { success: true, link: entry }
  }

  update(id: string, patch: Partial<Omit<InputLink, 'id'>>): InputLinkResult {
    const existing = this.links.get(id)
    if (!existing) return { success: false, error: `No link found for id "${id}".` }

    const updated: InputLink = { ...existing, ...patch, updatedAt: Date.now() }
    this.links.set(id, updated)
    return { success: true, link: updated }
  }

  get(id: string): InputLinkResult {
    const link = this.links.get(id)
    if (!link) {
      return { success: false, error: `No link found for id "${id}".` }
    }
    return { success: true, link }
  }

  list(options?: ListOptions): InputLink[] {
    const arr = Array.from(this.links.values())

    let filtered = arr
    if (options?.source) {
      filtered = filtered.filter(l => l.source === options.source)
    }

    if (options?.sortBy) {
      const dir = options.direction === 'desc' ? -1 : 1
      filtered.sort((a, b) => {
        const va = (a as any)[options.sortBy!]
        const vb = (b as any)[options.sortBy!]
        if (va < vb) return -1 * dir
        if (va > vb) return 1 * dir
        return 0
      })
    }

    return filtered
  }

  exists(id: string): boolean {
    return this.links.has(id)
  }

  count(): number {
    return this.links.size
  }

  unregister(id: string): boolean {
    return this.links.delete(id)
  }

  clear(): void {
    this.links.clear()
  }

  toArray(): InputLink[] {
    return Array.from(this.links.values())
  }

  fromArray(items: InputLink[]): { success: boolean; error?: string } {
    this.clear()
    for (const item of items) {
      if (!item.id || !item.source || !item.url) {
        return { success: false, error: `Invalid link object: ${JSON.stringify(item)}` }
      }
      this.links.set(item.id, { ...item, createdAt: item.createdAt ?? Date.now(), updatedAt: Date.now() })
    }
    return { success: true }
  }
}
