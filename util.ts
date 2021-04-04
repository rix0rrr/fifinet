export function objectFilter<F extends object, T extends F>(thing: T, filter: F) {
  for (const key in filter) {
    if (thing[key] !== filter[key]) {
      return false;
    }
  }

  return true;
}
