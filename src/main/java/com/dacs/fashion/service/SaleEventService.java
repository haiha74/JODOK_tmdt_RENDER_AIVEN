package com.dacs.fashion.service;
import com.dacs.fashion.entity.SaleEvent;
import com.dacs.fashion.repository.SaleEventRepository;
import com.dacs.fashion.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.math.*;
import java.time.LocalDateTime;
import java.util.*;
@Service @RequiredArgsConstructor
public class SaleEventService {
 private final SaleEventRepository repo;
 private final ProductRepository products;
 public List<SaleEvent> all(){return repo.findAll();}
 public boolean live(SaleEvent event){LocalDateTime now=LocalDateTime.now();return event.isEnabled() && !now.isBefore(event.getStartAt()) && now.isBefore(event.getEndAt());}
 public List<SaleEvent> active(){return repo.findAll().stream().filter(this::live).toList();}
 public SaleEvent bySlug(String slug){return repo.findBySlug(slug).filter(this::live).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Sự kiện không hoạt động"));}
 public SaleEvent save(Long id,SaleEvent input){
  if(input.getName()==null||input.getName().isBlank()||input.getSlug()==null||!input.getSlug().matches("[a-z0-9]+(?:-[a-z0-9]+)*"))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Tên hoặc slug không hợp lệ");
  if(input.getStartAt()==null||input.getEndAt()==null||!input.getEndAt().isAfter(input.getStartAt()))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Thời gian không hợp lệ");
  if(input.getDiscountType()==null||input.getDiscountValue()==null||input.getDiscountValue().signum()<0 ||(input.getDiscountType()==SaleEvent.DiscountType.PERCENT&&input.getDiscountValue().compareTo(BigDecimal.valueOf(100))>0))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Giảm giá không hợp lệ");
  if(repo.existsBySlugAndIdNot(input.getSlug(),id==null?-1L:id))throw new ResponseStatusException(HttpStatus.CONFLICT,"Slug đã tồn tại");
  if(input.getProductIds()==null)input.setProductIds(new HashSet<>());
  for(Long pid:input.getProductIds())if(pid==null||!products.existsById(pid))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Sản phẩm không tồn tại: "+pid);
  SaleEvent entity=id==null?new SaleEvent():repo.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND));
  entity.setName(input.getName()); entity.setSlug(input.getSlug());entity.setDescription(input.getDescription()); entity.setBannerUrl(input.getBannerUrl());entity.setMobileBannerUrl(input.getMobileBannerUrl());entity.setThemeColor(input.getThemeColor());entity.setStartAt(input.getStartAt());entity.setEndAt(input.getEndAt());entity.setEnabled(input.isEnabled());entity.setDiscountType(input.getDiscountType());entity.setDiscountValue(input.getDiscountValue());entity.setProductIds(new HashSet<>(input.getProductIds()));return repo.save(entity);
 }
 public void delete(Long id){if(!repo.existsById(id))throw new ResponseStatusException(HttpStatus.NOT_FOUND);repo.deleteById(id);}
 public BigDecimal price(Long productId,BigDecimal original){if(original==null)return null; BigDecimal best=original;
  for(SaleEvent e:active())if(e.getProductIds().contains(productId)){
   BigDecimal discounted=e.getDiscountType()==SaleEvent.DiscountType.PERCENT?original.multiply(BigDecimal.ONE.subtract(e.getDiscountValue().divide(BigDecimal.valueOf(100),6,RoundingMode.HALF_UP))):original.subtract(e.getDiscountValue());
   best=best.min(discounted.max(BigDecimal.ZERO));
  }
  return best.setScale(0,RoundingMode.HALF_UP);
 }
}
