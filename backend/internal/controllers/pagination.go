package controllers

const (
	maxPageSize     = 100
	defaultPage     = 1
	defaultPageSize = 10
)

// sanitizePagination clamps page and pageSize to safe bounds.
func sanitizePagination(page, pageSize int) (int, int) {
	if page < 1 {
		page = defaultPage
	}
	if pageSize < 1 {
		pageSize = defaultPageSize
	}
	if pageSize > maxPageSize {
		pageSize = maxPageSize
	}
	return page, pageSize
}
