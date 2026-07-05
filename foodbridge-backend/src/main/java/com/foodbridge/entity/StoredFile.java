package com.foodbridge.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StoredFile {

    private String name;
    private String type;
    private Long size;
    private String data;
    private String url;
    private String publicId;
}
