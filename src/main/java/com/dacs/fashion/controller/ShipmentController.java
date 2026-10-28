package com.dacs.fashion.controller;

import com.dacs.fashion.entity.Shipment;
import com.dacs.fashion.service.ShipmentService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/shipments")
@RequiredArgsConstructor
public class ShipmentController {

    private final ShipmentService shipmentService;

    @GetMapping
    public List<Shipment> getAll() {
        return shipmentService.getAll();
    }

    @GetMapping("/{id}")
    public Shipment getById(@PathVariable Long id) {
        return shipmentService.getById(id);
    }

    @PostMapping
    public Shipment create(@RequestParam Long orderId,
                           @RequestParam(required = false) Long staffId,
                           @RequestParam String trackingCode) {
        return shipmentService.create(orderId, staffId, trackingCode);
    }

    @PutMapping("/{id}/status")
    public Shipment updateStatus(@PathVariable Long id,
                                 @RequestParam String status) {
        return shipmentService.updateStatus(id, status);
    }

    @DeleteMapping("/{id}")
    public String delete(@PathVariable Long id) {
        shipmentService.delete(id);
        return "Xóa giao hàng thành công";
    }
}