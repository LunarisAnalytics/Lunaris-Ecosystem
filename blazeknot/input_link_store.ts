export interface InputLink {
  id: string
  source: string
  url: string
  metadata?: Record<string, any>
}

export interface InputLinkResult {
  success: boolean
  link?: InputLink
  error?: string
}

export interface ListOptions {
  source?: string
  sortBy?: 'id' | 'source'
  direction?: 'asc' | 'desc'
}

export class InputLinkHandler {
  private links = new Map<string, InputLink>()

  /**
   * Register a new link if the id does not exist
   */
  register(link: InputLink): InputLinkResult {
    const validation = this.validateLink(link)
    if (!validation.success) return validation

    if (this.links.has(link.id)) {
      return { success: false, error: `Link with id "${link.id}" already exists.` }
    }
    this.links.set(link.id, link)
    return { success: true, link }
  }

  /**
   * Create or update a link by id
   */
  upsert(link: InputLink): InputLinkResult {
    const validation = this.validateLink(link)
    if (!validation.success) return validation

    this.links.set(link.id, link)
    return { success: true, link }
  }

  /**
   * Update a subset of fields on an existing link
   */
  update(id: string, patch: Partial<Omit<InputLink, 'id'>>): InputLinkResult {
    const existing = this.links.get(id)
    if (!existing) return { success: false, error: `No link found for id "${id}".` }

    const updated: InputLink = { ...existing, ...patch, id }
    const validation = this.validateLink(updated)
    if (!validation.success) return validation

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

  /**
   * List links with optional filtering and sorting
   */
  list(options?: ListOptions): InputLink[] {
    const arr = Array.from(this.links.values())

    const filtered = options?.source ? arr.filter(l => l.source === options.source) : arr

    if (options?.sortBy) {
      const dir = options.direction === 'desc' ? -1 : 1
      filtered.sort((a, b) => (a[options.sortBy!] < b[options.sortBy!] ? -1 * dir : a[options.sortBy!] > b[options.sortBy!] ? 1 * dir : 0))
    }

    return filtered
  }

  getBySource(source: string): InputLink[] {
    return this.list({ source })
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

  /**
   * Export all links as a plain array (useful for persistence)
   */
  toArray(): InputLink[] {
    return Array.from(this.links.values())
  }

  /**
   * Replace all links with the provided array (id collisions are overwritten)
   */
  fromArray(items: InputLink[]): { success: boolean; error?: string } {
    for (const item of items) {
      const validation = this.validateLink(item)
      if (!validation.success) return { success: false, error: validation.error }
    }
    this.clear()
    for (const item of items) this.links.set(item.id, item)
    return { success: true }
  }

  /**
   * Basic structural and URL validation
   */
  private validateLink(link: InputLink): InputLinkResult {
    if (!link || !link.id || !link.source || !link.url) {
      return { success: false, error: 'Link must include non-empty id, source, and url.' }
    }
    if (!InputLinkHandler.isValidUrl(link.url)) {
      return { success: false, error: `Invalid URL: "${link.url}".` }
    }
    return { success: true, link }
  }

  static isValidUrl(url: string): boolean {
    try {
      // Accept only http/https protocols
      const u = new URL(url)
      return u.protocol === 'http:' || u.protocol === 'https:'
    } catch {
      return false
    }
  }
}
