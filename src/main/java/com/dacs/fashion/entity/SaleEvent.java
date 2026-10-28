package com.dacs.fashion.entity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.LocalDateTime;
import java.math.BigDecimal;
import java.util.HashSet;
import java.util.Set;
@Entity @Table(name="sale_events") @Getter @Setter
public class SaleEvent {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @Column(nullable=false) private String name;
 @Column(nullable=false,unique=true) private String slug;
 @Column(length=1000) private String description;
 private String bannerUrl;
 private String mobileBannerUrl;
 private String themeColor;
 @Column(nullable=false) private LocalDateTime startAt;
 @Column(nullable=false) private LocalDateTime endAt;
 private boolean enabled;
 @Column(nullable=false) private BigDecimal discountValue=BigDecimal.ZERO;
 @Enumerated(EnumType.STRING) @Column(nullable=false) private DiscountType discountType=DiscountType.PERCENT;
 @ElementCollection(fetch=FetchType.EAGER) @CollectionTable(name="sale_event_products",joinColumns=@JoinColumn(name="event_id")) @Column(name="product_id")
 private Set<Long> productIds=new HashSet<>();
 public enum DiscountType { PERCENT, AMOUNT }
}
