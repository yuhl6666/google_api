import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Domain } from '../schemas/taskMetadata.js';
import { CapabilityTag, ModelDescriptor } from './modelDescriptor.js';

interface RegistryFile {
  models: ModelDescriptor[];
}

/**
 * Model Registry (spec section 5): the single source of truth for which
 * models exist, what they're good for, and what they cost — loaded from a
 * JSON file today, swappable for a DB-backed source later without touching
 * the Router (it only depends on this class's public methods).
 */
export class ModelRegistry {
  private constructor(private readonly models: ModelDescriptor[]) {}

  static fromDescriptors(models: ModelDescriptor[]): ModelRegistry {
    return new ModelRegistry(models);
  }

  static loadFromFile(filePath: string): ModelRegistry {
    const raw = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw) as RegistryFile;
    return new ModelRegistry(data.models);
  }

  /** Loads the bundled `models.json` shipped with this package. */
  static loadDefault(): ModelRegistry {
    const defaultPath = fileURLToPath(new URL('./models.json', import.meta.url));
    return ModelRegistry.loadFromFile(defaultPath);
  }

  listAll(): ModelDescriptor[] {
    return [...this.models];
  }

  /** Only models with a real provider implementation wired up (status: 'active'). */
  listActive(): ModelDescriptor[] {
    return this.models.filter((m) => m.status === 'active');
  }

  get(id: string): ModelDescriptor | undefined {
    return this.models.find((m) => m.id === id);
  }

  findByDomain(domain: Domain): ModelDescriptor[] {
    return this.listActive().filter((m) => m.domain === domain);
  }

  findByCapability(capability: CapabilityTag): ModelDescriptor[] {
    return this.listActive().filter((m) => m.capabilities.includes(capability));
  }
}
