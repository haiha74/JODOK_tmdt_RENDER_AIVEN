package com.dacs.fashion.service;

import com.dacs.fashion.dto.CategoryDTO;
import com.dacs.fashion.entity.Category;
import com.dacs.fashion.repository.CategoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class CategoryService {

    private final CategoryRepository categoryRepository;

    public List<Category> getAll() {
        return categoryRepository.findAll();
    }

    public Category getById(Long id) {
        return categoryRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy danh mục"));
    }

    public Category create(CategoryDTO dto) {
        Category category = new Category();
        category.setCategoryName(dto.getCategoryName());
        category.setDescription(dto.getDescription());
        category.setStatus(dto.getStatus());
        category.setImageUrl(dto.getImageUrl());

        if (dto.getParentId() != null) {
            category.setParent(getById(dto.getParentId()));
        }

        return categoryRepository.save(category);
    }

    public Category update(Long id, CategoryDTO dto) {
        Category category = getById(id);
        category.setCategoryName(dto.getCategoryName());
        category.setDescription(dto.getDescription());
        category.setStatus(dto.getStatus());
        category.setImageUrl(dto.getImageUrl());

        if (dto.getParentId() != null) {
            category.setParent(getById(dto.getParentId()));
        } else {
            category.setParent(null);
        }

        return categoryRepository.save(category);
    }

    public void delete(Long id) {
        categoryRepository.deleteById(id);
    }
}