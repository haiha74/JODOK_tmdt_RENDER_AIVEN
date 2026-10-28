package com.dacs.fashion.service;

import com.dacs.fashion.entity.Order;
import com.dacs.fashion.entity.Shipment;
import com.dacs.fashion.entity.User;
import com.dacs.fashion.repository.OrderRepository;
import com.dacs.fashion.repository.ShipmentRepository;
import com.dacs.fashion.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ShipmentService {

    private final ShipmentRepository shipmentRepository;
    private final OrderRepository orderRepository;
    private final UserRepository userRepository;

    public List<Shipment> getAll() {
        return shipmentRepository.findAll();
    }

    public Shipment getById(Long id) {
        return shipmentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy giao hàng"));
    }

    public Shipment create(Long orderId, Long staffId, String trackingCode) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy đơn hàng"));

        Shipment shipment = new Shipment();
        shipment.setOrder(order);
        shipment.setTrackingCode(trackingCode);
        shipment.setShippingStatus("PREPARING");

        if (staffId != null) {
            User staff = userRepository.findById(staffId)
                    .orElseThrow(() -> new RuntimeException("Không tìm thấy nhân viên"));
            shipment.setStaff(staff);
        }

        return shipmentRepository.save(shipment);
    }

    public Shipment updateStatus(Long id, String status) {
        Shipment shipment = getById(id);
        shipment.setShippingStatus(status);

        if ("SHIPPING".equals(status)) {
            shipment.setShippedAt(LocalDateTime.now());
        }

        if ("DELIVERED".equals(status)) {
            shipment.setDeliveredAt(LocalDateTime.now());
        }

        return shipmentRepository.save(shipment);
    }

    public void delete(Long id) {
        shipmentRepository.deleteById(id);
    }
}