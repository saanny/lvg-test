export interface PaginationMeta {
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
  totalPages: number;
  nextPage: number | null;
  prevPage: number | null;
  itemsCount: number;
}

export interface Paginated<T> {
  items: T[];
  meta: PaginationMeta;
}
