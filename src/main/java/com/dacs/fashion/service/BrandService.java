package com.dacs.fashion.service;

import com.dacs.fashion.dto.BrandDTO;
import com.dacs.fashion.entity.Brand;
import com.dacs.fashion.repository.BrandRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class BrandService {

    private final BrandRepository brandRepository;

    public List<Brand> getAll() {
        return brandRepository.findAll();
    }

    public Brand getById(Long id) {
        return brandRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy thương hiệu"));
    }

    public Brand create(BrandDTO dto) {
        Brand brand = new Brand();
        brand.setBrandName(dto.getBrandName());
        brand.setDescription(dto.getDescription());
        brand.setStatus(dto.getStatus() == null ? "ACTIVE" : dto.getStatus());

        return brandRepository.save(brand);
    }

    public Brand update(Long id, BrandDTO dto) {
        Brand brand = getById(id);

        brand.setBrandName(dto.getBrandName());
        brand.setDescription(dto.getDescription());
        brand.setStatus(dto.getStatus());

        return brandRepository.save(brand);
    }

    public void delete(Long id) {
        Brand brand = getById(id);
        brandRepository.delete(brand);
    }
}