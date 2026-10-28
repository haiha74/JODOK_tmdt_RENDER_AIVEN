package com.dacs.fashion.repository;

import com.dacs.fashion.entity.Category;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CategoryRepository extends JpaRepository<Category, Long> {

}