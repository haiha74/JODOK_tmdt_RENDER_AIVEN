package com.dacs.fashion.repository;
import com.dacs.fashion.entity.SaleEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
public interface SaleEventRepository extends JpaRepository<SaleEvent,Long> {
 Optional<SaleEvent> findBySlug(String slug);
 boolean existsBySlugAndIdNot(String slug,Long id);
}
