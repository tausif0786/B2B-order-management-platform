USE b2b_order_management;
INSERT INTO products (sku,name,description,category,price,stock_quantity,reorder_level) VALUES
('OFF-PPR-A4','A4 Copier Paper (500 sheets)','Premium 80 GSM copier paper for offices.','Office Supplies',245.00,120,20),
('IT-MSE-WL1','Wireless Optical Mouse','Ergonomic wireless mouse with USB receiver.','IT Accessories',599.00,45,10),
('OFF-NBK-A5','A5 Executive Notebook','Hard-cover ruled notebook for daily business use.','Office Supplies',125.00,80,15),
('IT-KBD-104','USB Keyboard','Full-size wired keyboard with numeric keypad.','IT Accessories',749.00,8,10),
('PKG-TAPE-48','Packaging Tape 48mm','Heavy-duty clear carton sealing tape.','Packaging',68.00,200,30)
ON DUPLICATE KEY UPDATE name=VALUES(name);
